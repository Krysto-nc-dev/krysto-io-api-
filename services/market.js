// const moment = require('moment')
// const config = require('config')

const { Instance } = require('../models/Instance')
const { Offer } = require('../models/Offer')
const { User } = require('../models/User')
const { Nego } = require('../models/Nego')
const { Proposition } = require('../models/Proposition')

const OtoService = require('../services/oto')
const MailCoreService = require('../services/mailcore')
const BlockchainService = require('../services/blockchain')

module.exports = class MarketService {

  constructor() {}

  async saveOffer(params, creatorUserId){

    let creator = await User.findOne({ _id: creatorUserId })

    let offer = new Offer(params)

    offer.creator = creatorUserId
    offer.coordinates = [parseFloat(params.lng), parseFloat(params.lat)] //lng en premier pour l'indexation geospacial de mongo

    let date = new Date()
    offer.created = date 
    offer.updated = date

    await offer.save()

    if(creator.offers == null) creator.offers = []
    creator.offers.unshift(offer)
    await creator.markModified("offers")

    //si le créateur n'a pas encore défini son adresse perso
    if(creator.coordinates[0] == null){
      //enregistre l'adresse de son annonce
      creator.coordinates = [parseFloat(params.lat), parseFloat(params.lng)]
      creator.city = params.city
      creator.address = params.address
    }

    await creator.save()

    let blockchainService = new BlockchainService()
    await blockchainService.saveOffer(offer)

    return offer
  }

  async editOffer(params, creatorUserId){

    //let creator = await User.findOne({ _id: creatorUserId})

    let offer = await Offer.findOne({ _id: params.id, creator: creatorUserId })

    if(offer == null) return false 

    offer.coordinates = [parseFloat(params.lng), parseFloat(params.lat)]

    const attributes = ['title', 'text', 'category', 'type', 
                        'amountMony', 'city', 'address', 'text',
                        'lat', 'lng', 'status' ]

    attributes.forEach(param => {
      if(params[param] != null) offer[param] = params[param]
    })

    let date = new Date()
    offer.updated = date

    await offer.save()
    //console.log("offer", offer)

    return offer
  }

  async payOffer(offerId, fromWalletUid, userId, ws){
    let offer = await Offer.findOne({ _id: offerId })
                         .populate({ path: 'propositions', populate: { path : 'negos' }})
                         .populate({ path: 'creator',
                                    select: ['_id', 'name']
                                  })
  
  if(offer == null) 
    return { error: true, msg: "L'annonce n'a pas été trouvée." }

  if(offer.status == "PAID") 
    return { error: true, msg: "L'annonce a déjà été payées." }

    let propositionAccepted = null
    let negoAccepted = null
    offer.propositions.forEach((prop)=>{
      prop.negos.forEach((nego)=>{
        if(nego.status == 'ACCEPTED'){
          propositionAccepted = prop
          negoAccepted = nego
        }
      })
    })

    if(negoAccepted == null)
      return { error: true, 
                        msg: "Aucune négociation n'a abouti pour cette annonce." }


    if(propositionAccepted.userCaller != userId)
      return { error: true, 
               msg: "Vous n'êtes pas l'auteur de cette proposition." }


    const otoService = new OtoService()
    let fromWallet = await otoService.getWalletByUid(fromWalletUid)
    let toWallet = await otoService.getWalletDepositByUserId(offer.creator._id)

    if(otoService.convertUnityMony(fromWallet.amountUnity) < negoAccepted.amount)
      return { error: true, 
               msg: "Le compte n° " + fromWallet.uid + " ne dispose pas des fonds suffisants pour cette transaction" }

    const i = await Instance.findOne()
    let trans = await otoService.saveTransaction(
                                    negoAccepted.amount, 
                                    fromWallet, toWallet, 
                                    "Achat > " + offer.title, 
                                    i.monyConvertValue)

    offer.status = "PAID"
    await offer.save()

    negoAccepted.status = "PAID"
    negoAccepted.save()
    
    let blockchainService = new BlockchainService()
    //await blockchainService.saveNego(nego)
    await blockchainService.saveProposition(propositionAccepted)
    
    let userBuyer = await User.findOne({ _id: userId })
    //envoie une notif au vendeur, pour lui dire que la transaction vient d'être réalisée
    ws.emit(offer.creator._id, "new-offer-paid", 
                { message: "Vous venez de recevoir " + negoAccepted.amount + " oto" +
                           " de la part de " + userBuyer.name + 
                           " pour votre annonce \""+ offer.title + "\""
                })
                
    return { error: offer == null, trans: trans }
  }

  async searchOffer(params){

    let limit = params.fetchLimit ? params.fetchLimit : 100
    let skip = params.skip ? (params.skip * limit) : 0

    let query = { status : 'OPEN' }
    
    if(params.search != null && params.search != "")
      query.title = new RegExp(".*"+params.search.toLowerCase().trim(), "i")
    
    if(params.categoryId != null)
      query.category = params.categoryId

    if(params.offerType != null)
      query.type = params.offerType

    //montant minimum des annonces
    if(params.amountMin == null) params.amountMin = 0 

    //montant maximum des annonces
    if(params.amountMax != null)
      query['$and'] = [ { amountMony: { '$gte' : params.amountMin } },
                        { amountMony: { '$lte' : params.amountMax } } ]

    if(params.coordinates != null && params.radius != null)
      query.coordinates = {
          '$geoWithin': {
              '$centerSphere' :
                  [[params.coordinates[1], params.coordinates[0]], 
                    params.radius/1000/6371] 
         } 
      }

    //ne pas afficher les annnonces qui ont reçu au moins 3 signalements
    query['reports.2'] = { '$exists' : false }

    //console.log("query", query.coordinates["$geoWithin"]["$centerSphere"])

    //renvoie le nombre total de résultat pour cette requete
    let countOffers = await Offer.countDocuments(query)

    //execue la requete
    let offers = await Offer.find(query)
                            .populate('category')
                            .populate({ path: 'creator',
                                        select: ['_id', 'name']
                                      })
                            .sort({'updated':-1})
                            .limit(limit)
                            .skip(skip)

    return { error: false, countOffers: countOffers, offers: offers }
  }

  async sendProposition(params, user){
    let offer = await Offer.findOne({ _id: params.offerId })
                           .populate({ path: "creator", select: ['_id', 'name', 'city'] })

    if(offer == null)
      return { error: true, msg: 'offer id:' + params.offerId + ' not found' }

    let nego = new Nego()
    nego.amount = params.amount
    nego.msgTxt = params.msgTxt
    nego.status = "OPEN"
    nego.created = new Date()
    nego.updated = new Date()

    let prop = await Proposition.findOne({ offer: offer._id, 
                                          userCaller: user._id })
                                .populate('negos')

    if(prop == null){

      try{
        //enregistre la nouvelle negociation
        //await nego.save()

        prop = new Proposition()
        prop.offer = offer._id
        prop.userCaller = user._id
        prop.negos = [nego]
        await prop.save()

        if(offer.propositions == null) offer.propositions = []
        offer.propositions.push(prop._id)
        offer.markModified("propositions")
        await offer.save()

        if(user.propositionsSent == null) user.propositionsSent = []
        user.propositionsSent.push(prop._id)

        user.markModified("propositionsSent")
        await user.save()

        //nego.proposition = prop
        //await nego.save()
      }catch(e){
        console.log("catch in service Market sendProposition()", e)
      }
    }
    else{
      //vérifie si une negociation est déjà ouverte (pas encore répondue)
      let yetOpen = false 
      prop.negos.forEach((nego)=>{ if(nego.status == "OPEN") yetOpen = true })
      if(yetOpen) return { error: true, msg: 'Vous avez déjà envoyé une proposition. Merci d\'attendre la réponse du vendeur.' }

      //enregistre la nouvelle negociation
      //await nego.save()

      prop.negos.push(nego)
      await prop.markModified("negos")
      await prop.save()

    }

    nego.proposition = prop
    await nego.save()

    const mailCoreService = new MailCoreService()
    mailCoreService.sendMailByTemplate(offer.creator, 'user', 'newProposition', { offerId : offer._id })
    
    return { error: false, offer: offer }
  }

  
  async deleteOffer(offerId, user){
    let offer = await Offer.findOne({ _id: offerId })

    if(offer == null)
      return { error: true, msg: 'offer id:' + offerId + ' not found' }

    offer = await Offer.findOne({ _id: offerId, creator: user._id })

    if(offer == null)
    return { error: true, msg: 'You are not the creator of this offer : ' + offerId }


    let props = await Proposition.find({ offer: offerId })

    props.forEach(async (prop) => {
      prop.negos.forEach(async (nego) => {
        await Nego.deleteOne({ _id: nego })
      })
      await Proposition.deleteOne({ _id: prop._id })
    })
    
    await Offer.deleteOne({ _id: offerId, creator: user._id })

    return { error: false }
  }

  async cancelProposition(propId, user){
    let prop = await Proposition.findOne({ _id: propId })

    if(prop == null)
      return { error: true, msg: 'prop id:' + propId + ' not found' }

    prop = await Proposition.findOne({ _id: propId, userCaller: user._id }).populate("offer")

    if(prop == null)
    return { error: true, msg: 'You are not the creator of this proposition : ' + propId }

    let offer = await Offer.findOne({ _id: prop.offer._id })
    offer.status = "OPEN"
    await offer.save()

    await Proposition.deleteOne({ _id: propId, userCaller: user._id })

    return { error: false }
  }

  
}
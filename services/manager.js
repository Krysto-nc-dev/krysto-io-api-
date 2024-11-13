const config = require('config')
const { User } = require('../models/User')
const BlockchainService = require('../services/blockchain')
const MailCoreService = require('../services/mailcore')

const { Instance } = require('../models/Instance')
const { Offer } = require('../models/Offer')
const { Nego } = require('../models/Nego')
const { Proposition } = require('../models/Proposition')
const { Conversation } = require('../models/Conversation')
const { WalletMain } = require('../models/WalletMain')
const { WalletDeposit } = require('../models/WalletDeposit')
const { Report } = require('../models/Report')

module.exports = class ManagerService {
  

  async deleteUser(user, onlyBan=false, saveDelete=true, pastPremium = false, realDelete=false){
    console.log("deleteUser", user._id, onlyBan, saveDelete, pastPremium, realDelete)
    //resiliation de l'abonnement
    if(user.plan.key != "premium" && user.plan.key != "onemonth"){
      let stripe = require('stripe')(config.get("stripe.private_key"))
      stripe.subscriptions.del(user.paymentSubscriptionId)
    }

    //calcule le nombre d'unité totale créé pour ce user
    let userTotalUnity = 0
    //console.log("userIsActive ?", userIsActive)

    if(user.walletMain != null && user.walletMain.transactions != null)
    user.walletMain.transactions.forEach(async (trans)=>{
        if((trans.fromWallet != null && trans.fromWallet.id == "DAILY")
        ||  trans.type == "create") 
        userTotalUnity += trans.amountUnity
    })
    
    //supprime les annonces publiées par le user
    let offers = await Offer.find({ creator: user._id })

    //supprime les signalements lié à chaque annonce publié par le user
    offers.forEach(async (offer)=>{
      let report = await Report.findOne({ offer: offer._id })
      if(report != null){
        report.status = "CLOSED"
        await report.save()
      }
    })

    //supprime les annonces publiées par le user
    await Offer.updateMany({ creator: user._id }, { status: "LOCKED" })

    //supprime les conversations auxquelles a participé le user
    await Conversation.deleteMany({ '$or' : [{ user1: user._id }, { user2: user._id }] })

    //supprime les propositions envoyées par le user
    let props = await Proposition.find({ userCaller: user._id })
    props.forEach(async (prop) => {
      prop.negos.forEach(async (prop) => {
        //supprime les négociations
        await Nego.deleteMany({ proposition: prop._id })
      })
    })
    await Proposition.deleteMany({ userCaller: user._id })

    //supprime les comptes de dépots du user (la monnaie qu'il contient est perdue)
    if(user.walletsDeposit != null)
    user.walletsDeposit.forEach(async (walletId)=>{
        await WalletDeposit.deleteOne({ _id: walletId })
    })

    //supprime le compte courant
    await WalletMain.deleteOne({ _id: user.walletMain })

    let blockchainService = new BlockchainService()
    let userIsActive = user.isActive 

    //envoi un mail au user qui est supprimé
    const mailCoreService = new MailCoreService()
    let emailKey = pastPremium ? 'deleteAccountPastPremium' : 'deleteAccount'
    emailKey = onlyBan ? 'banAccount' : emailKey
    console.log("sendMail", emailKey)

    let { mailRes, emailParams } = await mailCoreService.sendMailByTemplate(user, 'user', emailKey)
        
    //si on demande seulement un bannissement
    //on ne delete pas le user
    if(onlyBan){
      let user2 = await User.findOne({ _id: user._id })
                            .populate("plan")
                            .populate("walletMain")
                            .populate("walletsDeposit")

      userIsActive = user2.isActive

      user2.isActive = false
      user2.isLocked = !realDelete //realDelete = le user demande à supprimer son compte
      user2.isDeleted = realDelete 
      user2.walletMain = null
      user2.walletsDeposit = []

      //enregistre l'évenement dans la blockchain
      if(saveDelete)
      await blockchainService.saveUserBanned(user2)
      //enregistre en bdd
      await user2.save()
    }
    else{
      //enregistre l'action dans la blockchain
      if(saveDelete)
      await blockchainService.saveUserDeleted(user)
      //supprime le user
      await User.deleteOne({ _id: user._id })
    }


    //si le user n'a pas été activé
    //il n'y a pas de monnaie à retirer de la masse monétaire
    console.log("userIsActive ?", userIsActive, userTotalUnity)
    if(userIsActive){
      //recalcule le taux de conversion de la monnaie (normalement il ne change pas)
      let nbUser = await User.countDocuments({  isActive: true, isLocked: false, isDeleted: false, walletMain: { $exists: true, $ne: null }  })
      let i = await Instance.findOne({ name : "main" })

      i.unityTotal = i.unityTotal - userTotalUnity
      console.log("monyConvertValue BEFORE", i.monyConvertValue, "nbUser", nbUser)
      //i.monyConvertValue = i.unityTotal / nbUser / (365.25 / 12)
      console.log("monyConvertValue AFTER", i.unityTotal / nbUser / (365.25 / 12), "nbUser", nbUser)

      //c'est peut être risqué de recalculer le taux de conversion au moment même de la suppression
      //il faudrait mettre un flag sur le user à supprimer
      //et faire toutes les suppressions juste avant le DAILY à 4h de mat'

      //ou ne pas le recalculer ! de toutes façons le taux de conversion ne change pas !

      await i.save()
    }

    return { error: false, mailRes: mailRes, emailParams: emailParams }
  }
}
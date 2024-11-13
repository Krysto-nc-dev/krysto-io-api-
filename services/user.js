const { User, validate } = require('../models/User')
const { Instance } = require('../models/Instance')
const { Plan } = require('../models/Plan')
const { WalletMain } = require('../models/WalletMain')
const { WalletDeposit } = require('../models/WalletDeposit')
const { OfferCategory } = require('../models/OfferCategory')

const bcrypt = require("bcrypt")

const OtoService = require('../services/oto')
const MarketService = require('../services/market')
const BlockchainService = require('../services/blockchain')
const ManagerService = require('../services/manager')
const MailCoreService = require('../services/mailcore')

module.exports = class UserService {

  constructor() {}

  async createUser(params){
    //si c'est le premier utilisateur créé : 
    //on lui attribut automatiquement le rôle d'admin
    let users = await User.countDocuments()
    let isAdmin = true //(users == 0)
    let emailChecked = true // isAdmin

    //vérifie que le nouveau user a sélectionné un plan
    let nbPlan = await Plan.countDocuments()
    let plan = await Plan.findOne({ key: params.planKey })
    if(plan == null && nbPlan > 0) return null 

    //si le plan est gratuit (premium) : 
    //vérifie que le nombre d'utilisateur limit du plan n'a pas été atteint
    // if(plan != null && plan.type == "free"){
    //   let nb = await User.countDocuments()
    //   let i = await Instance.findOne({ name: 'main' })
    //   if(nb > i.limitForFreePlan) return null 
    // }
    
    //si le plan est gratuit, on dit que le plan a été payé
    let planPaid = (plan == null || plan.type == "free")
    let planId = plan != null ? plan._id : null

    let emailToken = Math.random().toString(36).substr(2)
    emailToken += Math.random().toString(36).substr(2)

    let user = new User({
      name: params.name,
      password: params.password,
      coordinates: [],
      email: params.email,
      emailChecked: emailChecked,
      emailToken: emailToken,
      isActive: false,
      isLocked: false,
      planPaid: planPaid,
      isAdmin: isAdmin,
      plan: planId,
      enableMailNotif: true,
      lastMail: new Date(),
      created: new Date(),
      updated: new Date()
    })

    //cryptage du mot de passe
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(user.password, salt)

    await user.save()

    console.log("New user created", user.name)
    return user
  }

  async confirmEmail(user){
    //confirmation du mail
    user.emailChecked = true 

    //si le paiement a été effectué (ou si plan gratuit)
    if(user.planPaid){
      //création du compte courant lié à cet utilisateur
      let mainWallet = await this.createMainWallet(user)
      //création du compte de dépot lié à cet utilisateur
      let depositWallet = await this.createDepositWallet(user)
      //enregistre les comptes dans le user
      user.walletMain = mainWallet.id
      user.walletsDeposit.push(depositWallet.id)
    }
    await user.save()

    let blockchainService = new BlockchainService()
    blockchainService.saveUser(user)
    
    //console.log("User email checked", user.name)
    return user
  }

  async confirmPayment(user){
    //confirmation du mail
    user.planPaid = true 

    //création du compte courant lié à cet utilisateur
    let mainWallet = await this.createMainWallet(user)
    //création du compte de dépot lié à cet utilisateur
    let depositWallet = await this.createDepositWallet(user)
    //enregistre les comptes dans le user
    user.walletMain = mainWallet.id
    user.walletsDeposit.push(depositWallet.id)
    
    await user.save()
    //console.log("User email checked", user.name)
    return user
  }

  //création d'un nouveau wallet pour un user donné
  async createMainWallet(user){

    let otoService = new OtoService()
    let i = await Instance.findOne()
    let monyConvertValue = i != null ? i.monyConvertValue : 0
    //récupère le montant à ajouter pour initialiser la wallet
    let amountUnity = await otoService.getFirstAmountUnity()
    let amountMony = otoService.convertUnityMony(amountUnity, monyConvertValue)

    //console.log("create main wallet", amountUnity, amountMony, monyConvertValue)
    let uid = await this.getNewWalletUid()
    let wallet = new WalletMain({
      uid: uid,
      name: "MAIN",
      owner: user,
      amountMony: 0,
      amountUnity: 0,
      transactions: [],
      created: new Date(),
      updated: new Date()
    })
    await wallet.save()

    let blockchainService = new BlockchainService()
    await blockchainService.saveWalletMain(wallet)

    //versement du premier montant sur le compte
    //c'est saveTransaction qui modifiera les montants du wallet
    await otoService.saveTransaction(amountMony, "DAILY", wallet, "Ouverture du compte", monyConvertValue)
    
    return wallet
  }

  //création d'un nouveau wallet pour un user donné
  async createDepositWallet(user){

    let uid = await this.getNewWalletUid()
    let wallet = new WalletDeposit({
      uid: uid,
      name: "DEPOSIT",
      owner: user,
      amountMony: 0,
      amountUnity: 0,
      transactions: [],
      created: new Date(),
      updated: new Date()
    })
    await wallet.save()

    let blockchainService = new BlockchainService()
    await blockchainService.saveWalletDeposit(wallet)

    return wallet
  }

  //génère un UID de 4 lettres et 2 chiffres, pour les wallet
  async getNewWalletUid(){
    let uid = null
    let found = false 
    while(found == false){
      uid = this.randUid()
      let userExists = await User.findOne({ uid: uid })
      found = (userExists == null)
    }
    return uid
  }

  randUid(){
    let uid = ""
    //4 lettres
    for(let i = 0; i < 4; i++){
      let rand = parseInt(Math.random()*26)
      rand = String.fromCharCode(rand + 65)
      uid += rand
    }
    //2 chiffres
    for(let i = 0; i < 2; i++){
      let rand = parseInt(Math.random()*10)
      uid += rand
    }
    return uid
  }

  //supprimer tous les compte PREMIUM (gratuits) qui n'ont pas publié d'annonce avant 30 jours
  async deletePastPremium(){

    let date7days = new Date()
    date7days.setDate(date7days.getDate() - 30)

    let premiumPlan = await Plan.findOne({ type: 'free' })
    let users = await User.find({ 
                  'plan' : premiumPlan._id,
                  'offers.0' : { '$exists' : false },
                  'created' : { '$lt' : date7days }
                })
                .populate("plan")
                .populate("walletMain")
                .populate("walletDeposit")

    console.log("deletePastPremium", users.length)
    let managerService = new ManagerService()

    if(users.length > 0) 
    for await (let user of users){
      await managerService.deleteUser(user, false, true, true)
    }

    return users.length
  }

  //envoyer un mail à tous les user PREMIUM qui n'ont pas publié d'annonce depuis X jours
  async mailPastPremium(nbDays){

    let datePastdays = new Date()
    let datePastdaysLimit = new Date()
    datePastdays.setDate(datePastdays.getDate() - nbDays)
    datePastdaysLimit.setDate(datePastdays.getDate() - 1)

    console.log("DATE : ", datePastdays)
    console.log("DATE : ", datePastdaysLimit)

    let premiumPlan = await Plan.findOne({ type: 'free' })
    let users = await User.find({ 
                  'plan' : premiumPlan._id,
                  'offers.0' : { '$exists' : false },
                  'created' : { '$lt' : datePastdays, '$gt' : datePastdaysLimit }
                })
                .populate("plan")
                .populate("walletMain")
                .populate("walletDeposit")

    console.log("mailPastPremium", users.length)

    if(users.length > 0) 
    for await (let user of users){
      console.log("NO OFFER : ", user.name)

      const mailCoreService = new MailCoreService()
      let { mailRes, emailParams } = await mailCoreService.sendMailByTemplate(user, 'user', 'reminderPastPremium')
      //console.log({ error: false, user: user, mailRes, emailParams })
      //await managerService.deleteUser(user, false, true, true)
    }

    return users.length
  }



  async createDevData(){
    console.log("*** createDevData")
    
    let marketService = new MarketService()
    console.log("process.env.NODE_ENV", process.env.NODE_ENV)
    //création de 10 users
    if(process.env.NODE_ENV != 'production')
      await this.createSimUsers(5)

    //récupération du user Admin
    let admin = await User.findOne({ isAdmin: true })
    let admin2 = await User.findOne({ isAdmin: true, email: "superadmin@mail.com" })
    let admin3 = await User.findOne({ isAdmin: true, email: "jean@mail.com" })
    admin3 = admin 
    
    if(process.env.NODE_ENV == 'production'){
      admin2 = admin
      admin3 = admin
    }

    admin2 = admin
    admin3 = admin


    for(let i = 0; i<1; i++){
    
      // création des annonces
      let offerParams = {
        type: "OFFER",
        title: "Boucles d'oreilles",
        category: await this.getIdCategory('Bijoux'),
        text: "Ces superbes boucles d'oreille vous irons à ravir !",
        gallery: ['fictif/boucles-oreilles.webp'],
        amountMony: 2,
        city: "La Rochelle",
        address: "rue du chemin",
        lat: -22.278764039073968,
        lng: 166.45385742187503,
        status: "OPEN",
        fictif: true
      }

      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Véhicule'),
      offerParams.title = "Vélo bon état"
      offerParams.text = "Un super vélo avec un panier, en très bon état"
      offerParams.gallery = ['fictif/velo.webp']
      offerParams.amountMony = 8
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Véhicule'),
      offerParams.title = "206 Peugot 1.4 Hdi"
      offerParams.text = "Dernière révision à 136.000km avec vidange, distribution et changement pneus avant"
      offerParams.gallery = ['fictif/206.webp']
      offerParams.amountMony = 300
      offerParams.city = "Bordeaux"
      offerParams.address = "rue du chemin"
      offerParams.lat = -22.298764039073968
      offerParams.lng = 166.45385742187503
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Jardinage'),
      offerParams.title = "Tondeuse à gazon essence"
      offerParams.text = "Vend tondeuse en très bon état, très peu servi"
      offerParams.gallery = ['fictif/tondeuze.webp']
      offerParams.amountMony = 7
      offerParams.city = "Rochefort"
      offerParams.address = "rue du chemin"
      offerParams.lat = -22.268764039073968
      offerParams.lng = 166.45385742187503
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Technologie'),
      offerParams.title = "PC Windows 10 - 8Go RAM"
      offerParams.text = "Je vend mon PC pour m'en acheter un nouveau. Je l'ai depuis 2 ans, il marche encore très bien."
      offerParams.gallery = ['fictif/pc.webp']
      offerParams.lat = -22.268764039073968
      offerParams.lng = 166.44385742187503
      offerParams.amountMony = 80
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Technologie'),
      offerParams.title = "iPhone 10"
      offerParams.text = "Vend iPhone 10 "
      offerParams.gallery = ['fictif/iphone.webp']
      offerParams.amountMony = 70
      offerParams.city = "Lyon"
      offerParams.address = "rue du chemin"
      offerParams.lat = -22.248764039073968
      offerParams.lng = 166.43385742187503
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Vêtements'),
      offerParams.title = "Manteau hiver femme"
      offerParams.text = "Je vend un manteau pour femme, très peu porté"
      offerParams.gallery = ['fictif/manteau.webp']
      offerParams.amountMony = 4
      offerParams.city = "Niort"
      offerParams.address = "rue du chemin"
      offerParams.lat = -22.248764039073968
      offerParams.lng = 166.42385742187503
      await marketService.saveOffer(offerParams, admin._id)

      offerParams.category = await this.getIdCategory('Service'),
      offerParams.title = "Co-voiturage entre La Rochelle et Niort"
      offerParams.text = "Je fais le trajet tous les jours pour le travail, si ça vous intéresse on peut covoit' !"
      offerParams.gallery = ['fictif/covoiturage.webp']
      offerParams.amountMony = 2
      offerParams.city = "Nantes"
      offerParams.address = "rue du chemin"
      offerParams.lat = -22.248764039073968
      offerParams.lng = 166.41385742187503
      await marketService.saveOffer(offerParams, admin3._id)

      offerParams.category = await this.getIdCategory('Électroménager'),
      offerParams.title = "Grand frigo"
      offerParams.text = "Je vend mon frigo"
      offerParams.gallery = ['fictif/grand-frigo.webp']
      offerParams.amountMony = 12
      await marketService.saveOffer(offerParams, admin2 != null ? admin2._id : admin._id)

      console.log("*** Offers created")
    }
  }

  //créer des user pour la simulation
  async createSimUsers(nbUsers){
    let totalUser = await User.countDocuments()

    console.log("*** start createSimUsers", nbUsers)
    console.log("*** please wait")
    for(let i = 0; i < nbUsers; i++){
      let params = {
        name: "Sims" + (totalUser + i),
        email:"sims" + (totalUser + i) + "@mail.com",
        password: "simsimsim",
        planKey: "premium"
      }
      let user = await this.createUser(params)
      await this.confirmEmail(user)

      //console.log(i, "/", nbUsers)
    }
    console.log("*** createSimUsers done", nbUsers)
  }


  async getIdCategory(name){
    const categories = await OfferCategory.find()
    let catId = null 
    categories.forEach((cat)=>{ if(cat.name == name) catId = cat._id })
    return catId
  }

}
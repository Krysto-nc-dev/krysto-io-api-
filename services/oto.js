const config = require('config')
const { User } = require('../models/User')
const { Instance } = require('../models/Instance')
const { WalletMain } = require('../models/WalletMain')
const { WalletDeposit } = require('../models/WalletDeposit')

const { Offer } = require('../models/Offer')
const { Conversation } = require('../models/Conversation')
const { Proposition } = require('../models/Proposition')
const { Nego } = require('../models/Nego')
const { StateHistory } = require('../models/StateHistory')
const { Report } = require('../models/Report')

const ObjectID = require('mongodb').ObjectID

const BlockchainService = require('../services/blockchain')
const ManagerService = require('../services/manager')


module.exports = class OtoService {

  constructor() {
    this.blockchainService = null
  }

  async getInstance(){
    return await Instance.findOne()
  }

  // procédure qui effectue la création monétaire quotidienne
  async createDailyMony(saveHistory=true){
    
    let i =  await this.getInstance()
    let instanceExists = (i != null)
    if(!instanceExists) i = { unityTotal : 0, monyConvertValue: 0 }

    let total = 0

    //calcul le total du nombre d'unité dans les "nouveaux" walletMain
    //à l'inscription, l'utilisateur est "isActive == false"
    //tant qu'il n'a pas reçu son premier Dividende, il ne peut pas échanger de monnaie
    //parce que sa monnaie n'a pas été comptabilisé dans la masse monétaire.

    let qryUsrNotActive = { isActive: false,  
                            isLocked: false,  
                            isDeleted: false, 
                            walletMain: { $exists: true, $ne: null }
                          }

    //recherche s'il y a au moins un nouveau user
    let userExemple = await User.findOne(qryUsrNotActive)
                                .populate("walletMain")
    if(userExemple != null){
      //console.log("userExemple.walletMain", userExemple)
      //tous les user ont reçu la même quantité de monnaie
      let fstAmountUnity = userExemple.walletMain.amountUnity 
      //nombre de nouveaux utilisateurs
      let nbUserNotActive = await User.countDocuments(qryUsrNotActive)
      //donc le total de nouvelle unité :
      total = nbUserNotActive * fstAmountUnity
      await User.updateMany(qryUsrNotActive, { isActive: true })
    }

    //console.log("####### total", total)
    //ajoute le total des unités des comptes inactif
    //à l'ancien total de l'instance
    total = i.unityTotal + total 

    //s'il n'y a aucune unité : prend 1 comme valeur par défaut
    let calcTotal = (total == 0) ? 1 : total

    let nbUser = await User.countDocuments({ isActive: true, isLocked: false })
    
    //enregistre la valeur total dans l'instance
    i.unityTotal = calcTotal
    //calcule et enregistre le taux de conversion
    i.monyConvertValue = calcTotal / nbUser / (365.25 / 12)

    //console.log("!!!!!!!!!! monyConvertValue", i.monyConvertValue, calcTotal, nbUser)

    if(instanceExists) await i.save()
        
    //création d'un ID unique pour la transaction
    let id = 'DAILY' + new ObjectID() 
    
    //convertion du montant en Mony vers le montant en Unity
    const amountUnity = this.convertMonyUnity(1, i.monyConvertValue)

    //recalcule les nouvelles valeurs 
    total = total + (nbUser * i.monyConvertValue)
    
    let nextMonyConvertValue = total / nbUser / (365.25 / 12)
    //console.log("!!!!!!!!!! nextMonyConvertValue", nextMonyConvertValue, total, nbUser)

    //création de la data de transaction
    let transaction = {
      id: id,
      type: 'create',
      amountUnity: amountUnity,
      amountMony: 1,
      monyConvertValue: i.monyConvertValue, //valeur actuel du taux de convertion, pour pouvoir recalculer amountMony par la suite si besoin
      nextMonyConvertValue: nextMonyConvertValue, //valeur actuel du taux de convertion, pour pouvoir recalculer amountMony par la suite si besoin
      created: new Date()
    }

    //si saveHistory == false : raz pour restore from blockchain
    //les premières transactions des admins sont déjà envoyées
    let query = saveHistory ? {} : { isAdmin: false }
    //incrémente le nombre d'unité de tous les walletMain
    //et ajoute la transaction dans la liste
    await WalletMain.updateMany(query, { $inc: { amountUnity: amountUnity },
                                      $push: { 
                                        transactions: { 
                                          $each: [transaction],
                                          $position: 0
                                        }
                                      }})
    
    i.unityTotal = total
    //console.log("total2", total)
    i.monyConvertValue = nextMonyConvertValue
    await i.save()

    //enregistre l'état du système après la création monétaire quotidienne
    if(saveHistory)
    await this.saveStateHistory(false) //enlever false pour la prod !!! TODO
  }

  async rebase(){

    let rebaseRate = 0.0001
    try{
      await WalletMain.updateMany({}, { $mul: { 'amountUnity' : rebaseRate,
                                                'transactions.$[].amountUnity' : rebaseRate,
                                                'transactions.$[].monyConvertValue' : rebaseRate,
                                                'transactions.$[].nextMonyConvertValue' : rebaseRate } })
    }catch(e){
      console.log("error updateMany transactions.$[].amountUnity", e)
      console.log("error updateMany transactions.$[].amountUnity : catched")
    }

    try{
      await Instance.updateMany({}, { $mul: { 'unityTotal' : rebaseRate,
                                              'monyConvertValue' : rebaseRate } })
    }catch(e){
      console.log("error updateMany transactions.$[].amountUnity", e)
      console.log("error updateMany transactions.$[].amountUnity : catched")
    }

    return { error : false }
  }

  //remise à zéro du système
  async raz(saveHistory=true){
    let firstAmount = 0

    //supprime tous les users et les wallets (sauf les admin)
    let users = await User.find().populate("walletMain").populate("walletsDeposit")
    let adminWalletMain = []
    await Promise.all(users.map(async (user, n) => {
      if(!user.isAdmin){
        if(user.walletMain != null)
          await user.walletMain.remove()
          user.walletsDeposit.forEach((wallet)=>{ wallet.remove() })
          await user.remove()
          //console.log("> removed >", user.name)
      }else{
        //raz des montants des walletMain de l'admin
        //pour ne pas fausser le calcul du premier DU
        user.walletMain.transactions = []
        user.walletMain.amountMony = 0
        user.walletMain.amountUnity = firstAmount 
        await user.walletMain.save()

        //console.log("rebooted walletMain", user.walletMain)
        adminWalletMain.push(user.walletMain)

        //raz des walletDeposit
        user.walletsDeposit.forEach((wallet)=>{ 
          wallet.transactions = []
          wallet.amountMony = 0
          wallet.amountUnity = firstAmount 
          wallet.save()
        })

        user.walletsContact = []
        user.offers = []
        user.propositionsSent = []

        await user.save()

        console.log("> admin rebooted >", user.name)
      }
    }))

    //réinitialisation de la masse monétaire de l'instance
    let i = await Instance.findOne()
    i.unityTotal = firstAmount
    //le premier taux de conversion à appliquer
    i.monyConvertValue = 1
    await i.save()

    //supprime toutes les données liés aux utilisateurs et aux wallets qui viennent d'être supprimés
    await Offer.deleteMany()
    console.log("Table DROPED Offer")

    await Proposition.deleteMany()
    console.log("Table DROPED Proposition")
    
    await Nego.deleteMany()
    console.log("Table DROPED Nego")
    
    await Conversation.deleteMany()
    console.log("Table DROPED Conversation")
    
    await Report.deleteMany()
    console.log("Table DROPED Report")
    
    await StateHistory.deleteMany()
    console.log("Table DROPED StateHistory")
    
    
    console.log("> DBS DROPED <")

    await this.createDailyMony(saveHistory)

    //ajoute le premier montant au wallet de l'admin (qui vient d'être vidé)
    //après avoir calculé la valeur de l'oto
    // if(adminWalletMain.length > 0 && saveHistory){
    //   //console.log("> saveHistory <", saveHistory)
    //   let i = await Instance.findOne()
    //   //récupère le montant à ajouter pour initialiser la wallet
    //   let amountUnity = await this.getFirstAmountUnity()
    //   let amountMony = this.convertUnityMony(amountUnity, i.monyConvertValue)
    //   await Promise.all(adminWalletMain.map(async (wallet) => {
    //     console.log("> saveHistory <2", saveHistory)
    //     //await this.saveTransaction(amountMony, "DAILY", wallet, "Ouverture du compte", i.monyConvertValue)
    //   }))
    //   //await this.saveTransaction(amountMony, "DAILY", adminWalletMain, "Ouverture du compte", i.monyConvertValue)
    // }

    return true
  }

  //converti des Mony vers des Unités
  convertMonyUnity(amountMony, monyConvertValue){
    return amountMony * monyConvertValue
  }
  //converti des Unités vers des Mony 
  convertUnityMony(amountUnity, monyConvertValue){
    if(monyConvertValue == 0) return 0
    return amountUnity / monyConvertValue
  }

  //enregistrement d'une transaction
  async saveTransaction(amountMony, fromWallet, toWallet, libelle, monyConvertValue){

    if(toWallet == null) return null

    //convertion du montant en Mony vers le montant en Unity
    let amountUnity = this.convertMonyUnity(amountMony, monyConvertValue)

    if(typeof fromWallet != "string" )
      console.log("saveTransaction", fromWallet.amountUnity, amountUnity, 
                                     libelle, monyConvertValue)
    
    //vérifie que le compte qui envoie dispose de suffisemment de monnaie
    if(fromWallet.type == "MAIN" && fromWallet.amountUnity < amountUnity) return null
    if(fromWallet.type == "DEPOSIT" && fromWallet.amountMony < amountMony) return null

    //vérifie le plafond des wallet DEPOSIT
    const maxAD = config.maxAmountDeposit
    let refund = (toWallet.amountMony + amountMony) - maxAD
    //si la différence est positive : la transaction doit être plafonnée pour ne pas dépassé le plafond du comtpe qui reçoit
    if(toWallet.type == "DEPOSIT" && refund > 0) {
      //recalcule le montant de la transaction, pour que le compte de dépot == maxAmountDeposit
      amountMony = amountMony - refund
      //recalcule le montant correspondant en unités
      amountUnity = this.convertMonyUnity(amountMony, monyConvertValue)
    }else { //si ce n'est pas un compte de dépot, ou qu'il n'y a pas de dépassement du plafond
      refund = null //pour ne pas enregistrer refund dans la transaction
    }

    //si le fromWallet est un string : alors la transaction vient de la création monétaire createDailyMony()
    let fromWID = typeof fromWallet == "string" 
                ? fromWallet //donc on garde la valeur du string pour l'ID
                : fromWallet.id.substr(fromWallet.id.length - 5, 5) //sinon on prend l'id du wallet

    //création d'un ID unique pour la transaction
    let id = fromWID 
           + new ObjectID() 
           + toWallet.id.substr(toWallet.id.length - 5, 5)

    //création de la data de transaction
    let transaction = {
      id: id,
      type: 'exchange',
      amountUnity: amountUnity,
      amountMony: amountMony,
      monyConvertValue: monyConvertValue, //valeur actuel du taux de convertion, pour pouvoir recalculer amountMony par la suite si besoin
      nextMonyConvertValue: monyConvertValue,
      libelle: libelle,
      created: new Date(),
      toWallet: { 
        id: toWallet.id, 
        uid: toWallet.uid,
        name: toWallet.name, 
        ownerName: toWallet.owner.name
      }
    }

    if(refund != null) transaction.refund = refund
    
    //ajoute les données du wallet d'origine (celui qui envoie la monnaie)
    if(fromWallet == "DAILY"){ // si ça vient de la création monétaire
        transaction.fromWallet = { id: 'DAILY', uid: 'DAILY', name: 'DAILY' }
    }
    else if(fromWallet.id != null){ //sinon ça vient d'un autre utilisateur
        transaction.fromWallet = { 
          id: fromWallet.id, 
          uid: fromWallet.uid,
          name: fromWallet.name,
          ownerName: fromWallet.owner.name
        }

        // ### FROM
        //modifie le montant du wallet qui envoie la monnaie

        if(fromWallet.type == "MAIN"){ //si le wallet qui envoi est un compte courant
          //modifie le montant d'unités
          fromWallet.amountUnity = fromWallet.amountUnity - amountUnity
          //calcule la quantité de mony en convertissant le nombre d'unité
          fromWallet.amountMony = this.convertUnityMony(fromWallet.amountUnity, monyConvertValue)
        }else if(fromWallet.type == "DEPOSIT"){ //sinon retire directement le nombre de mony au total du compte
          fromWallet.amountMony = fromWallet.amountMony - amountMony //sans convertion (les comptes courant stock des Mony pas des Unity)
        }

        //ajoute la transaction dans l'historique du wallet d'origine
        fromWallet.transactions.unshift(transaction)
        await fromWallet.markModified("transactions")
        await fromWallet.save()

        //ajoute le wallet dans la liste des contacts du user qui envoie et de celui qui reçoit
        if(fromWallet.owner.id != toWallet.owner.id)
          await this.addWalletToMyContacts(fromWallet.owner.id, toWallet)
    }

    // ### TO

    if(toWallet.type == "MAIN"){ //si le wallet qui recoit est un compte courant
      //modifie le montant d'unités
      toWallet.amountUnity = toWallet.amountUnity + amountUnity
      //calcule la quantité de mony en convertissant le nombre d'unité
      toWallet.amountMony = this.convertUnityMony(toWallet.amountUnity, monyConvertValue)
    }else if(toWallet.type == "DEPOSIT"){ //sinon ajoute directement le nombre de mony au total du compte
      toWallet.amountMony = toWallet.amountMony + amountMony //sans convertion (les comptes courant stock des Mony pas des Unity)
    }

    //ajoute la transaction dans l'historique du wallet qui recoit
    toWallet.transactions.unshift(transaction)
    await toWallet.markModified("transactions")
    await toWallet.save()

    let blockchainService = new BlockchainService()
    await blockchainService.saveTransaction(transaction)

    return transaction
  }

  //ajoute un wallet dans la liste des contact d'un userId
  async addWalletToMyContacts(userId, newWalletContact){
    //récupère le user avec son wallet
    let user = await User.findOne({ _id: userId }).populate("walletMain")

    let wallet = { "uid" : newWalletContact.uid,
                   "ownerName" : newWalletContact.owner.name }

    //vérifie si le wallet n'est pas déjà dans la liste de contact du user
    let foundWallet = false
    user.walletsContact.forEach((userWallet) => {
      if(userWallet.uid == wallet.uid) foundWallet = true
    })
    if(!foundWallet){ //ajoute le wallet dans les contact du user
      user.walletsContact.unshift(wallet)
      await user.markModified("walletsContact")
      await user.save()
    }
    
    //pareil dans l'autre sens
    let walletFrom = { "uid" : user.walletMain.uid,
                       "ownerName" : user.name }

    //récupère le wallet contact, avec son owner, pour pouvoir vérifier si le contact existe déjà
    let walletC = await WalletMain.findOne({ uid: newWalletContact.uid }).populate("owner")

    if(walletC == null)
      walletC = await WalletDeposit.findOne({ uid: newWalletContact.uid }).populate("owner")

    if(walletC == null) return null

    //vérifie si le wallet n'est pas déjà dans la liste de contact du user
    foundWallet = false
    walletC.owner.walletsContact.forEach((userWallet) => {
      if(userWallet.uid == walletFrom.uid) foundWallet = true
    })
    if(!foundWallet){ //ajoute le wallet dans les contact du user propriétaire du wallet contact
      walletC.owner.walletsContact.unshift(walletFrom)
      await walletC.owner.markModified("walletsContact")
      await walletC.owner.save()
    }    
    await user.save()
  }

  //pour conserver l'équilibre de la monnaie,
  //on est obligé de donner l'équivalent de la moyenne recherchée
  //soit 365.25 / 12 = 30.4375 == le nombre de jour moyen dans 1 mois
  //getFirstAmountUnity retourne le nombre d'unité équivalent à 30.4375 Mony (oto)
  //utilisé à la création d'un nouveau wallet, pour créditer son compte avec le bon nombre d'unité
  async getFirstAmountUnity(){
    let i = await Instance.findOne()
    if(i == null) return 0
    return this.convertMonyUnity(30.4375, i.monyConvertValue)
  }

  //vérifier l'existance d'un wallet
  async walletExists(walletUid){
    let walletJson = {}
    let walletM = await WalletMain.findOne({ uid: walletUid })
                                  .populate('owner')
    
    //vérifie si l'uid correspond à un walletMain
    if(walletM != null){
      walletJson.uid = walletM.uid
      walletJson.type = "MAIN"
      walletJson.owner = { name: walletM.owner.name, 
                          isActive: walletM.owner.isActive }
    }else{ //sinon : vérifie si c'est un walletDeposit
      let walletD = await WalletDeposit.findOne({ uid: walletUid })
                                       .populate('owner')
      if(walletD != null){
        walletJson.uid = walletD.uid
        walletJson.type = "DEPOSIT"
        walletJson.owner = { name: walletD.owner.name, 
                            isActive: walletD.owner.isActive }
      }
    }
    return walletJson
  }

  //vérifier l'existance d'un wallet
  async getWalletByUid(walletUid){
    let walletM = await WalletMain.findOne({ uid: walletUid })
                                  .populate({ path: 'owner',
                                              select: ['_id', 'name', 'city']
                                            })
    //vérifie si l'uid correspond à un walletMain
    if(walletM != null){
      return walletM
    }else{ //sinon : vérifie si c'est un walletDeposit
      let walletD = await WalletDeposit.findOne({ uid: walletUid })
                                       .populate({ path: 'owner',
                                                   select: ['_id', 'name', 'city']
                                                 })
      return walletD
    }
  }

  async getWalletDepositByUserId(userId){
    return await WalletDeposit.findOne({ owner: userId, name: 'DEPOSIT' })
  }

  
  async saveStateHistory(checkExists=true){
    let instance = await Instance.findOne({ name: 'main' })

    //if a SH is already save today : no save any other, so exit
    let date1D = new Date()
    date1D.setDate(date1D.getDate() - 1);
    let s = await StateHistory.findOne({ date: { '$gt' : date1D } })
    if(s != null && checkExists){
      //console.log("error history already save today")
      return { error: true }
    }

    //initialize first state to 0 (if no document in collection)
    let shCount = await StateHistory.countDocuments()
    if(shCount == 0){
        let sh0 = new StateHistory({
            date: new Date(),
            nbUsers: 0,
            nbWalletMain: 0,
            nbWalletDeposit: 0,
            nbOffers: 0,
            nbReports: 0,
            amountTotalUnity: 0,
            amountTotalMony: 0,
            monyConvertValue: 0
        })
        await sh0.save()
    }

    let nbUsers = await User.countDocuments()
    let nbWalletMain = await WalletMain.countDocuments()
    let nbWalletDeposit = await WalletDeposit.countDocuments()
    let nbOffer = await Offer.countDocuments()
    let nbReports = await Report.countDocuments()
    let amountTotalMony =  this.convertUnityMony(instance.unityTotal, instance.monyConvertValue)

    //create new StateHistory for today
    let sh = new StateHistory({
        date: new Date(),
        nbUsers: nbUsers,
        nbWalletMain: nbWalletMain,
        nbWalletDeposit: nbWalletDeposit,
        nbOffers: nbOffer,
        nbReports: nbReports,
        amountTotalUnity: instance.unityTotal,
        amountTotalMony: amountTotalMony,
        monyConvertValue: instance.monyConvertValue
    })
    await sh.save() 

    let blockchainService = new BlockchainService()
    blockchainService.saveStateHistory(sh)

    console.log("/stat/save-state-history", sh.date)
    return { error: false }
  }


  async restoreFromBlockchain(){

    try{
      await this.raz(false)
      //await this.createDailyMony()

      this.blockchainService = new BlockchainService()

      let users = await this.restoreUsers()
      console.log("RESTORED USERS", users.length)

      let wms = await this.restoreWalletsMain()
      console.log("RESTORED WALLETMAIN", wms.length)

      let wmd = await this.restoreWalletsDeposit()
      console.log("RESTORED WALLETDEPOSIT", wmd.length)

      let offers = await this.restoreOffers()
      console.log("RESTORED OFFERS", offers.length)

      let reports = await this.restoreReports()
      console.log("RESTORED REPORTS", reports.length)

      let trans = await this.restoreTransactions()
      console.log("RESTORED TRANSACTIONS", trans.length)

      let convs = await this.restoreConversations()
      console.log("RESTORED CONVERSATIONS", convs.length)

      let props = await this.restorePropositions()
      console.log("RESTORED PROPOSITIONS", props.length)

      let usersDel = await this.restoreUserDeleted()
      console.log("RESTORED USER DELETED", usersDel.length)

      
      //raz masse monétaire de l'instance
      let i = await Instance.findOne({ name: 'main' })
      let stateHistory = await this.blockchainService.queryBlockchain('statehistory', 1)
      i.unityTotal = stateHistory[0].data.json.amountTotalUnity
      i.monyConvertValue = stateHistory[0].data.json.monyConvertValue
      i.nbUsers = stateHistory[0].data.json.nbUsers
      await i.save()

      console.log("RESTORED INSTANCE amountTotalUnity", stateHistory[0].data.json.amountTotalUnity)

      console.log(">>")
      console.log(">> ALL CHAIN RESTORED")

    }catch(e){
      console.log("error restoreFromBlockchain", e)
    }
  }

  async restoreUsers(){
    let datas = await this.blockchainService.queryBlockchain('user')
    datas.forEach(async (data) => {
      let d = new User(data.data.json)
      d.isActive = (d.walletMain != null)
      await d.save()
      //console.log("Restored User", d.name)
    })
    return datas
  }

  async restoreWalletsMain(){
    let datas = await this.blockchainService.queryBlockchain('walletMain')
    datas.forEach(async (data) => {
      let d = new WalletMain(data.data.json)
      await d.save()
      //console.log("Restored WalletMain", d.name)
    })
    return datas
  }

  async restoreWalletsDeposit(){
    let datas = await this.blockchainService.queryBlockchain('walletDeposit')
    datas.forEach(async (data) => {
      let d = new WalletDeposit(data.data.json)
      await d.save()
      //console.log("Restored WalletDeposit", d.name)
    })
    return datas
  }

  async restoreOffers(){
    let datas = await this.blockchainService.queryBlockchain('offer')
    datas.forEach(async (data) => {
      let d = new Offer(data.data.json)
      await d.save()

      let creator = await User.findOne({ _id: d.creator })
      if(typeof creator.offers != 'Array') creator.offers = []
      creator.offers.push(d)
      await creator.save()
      //console.log("Restored Offer", d.title)
    })
    return datas
  }
  
  async restoreConversations(){
    let datas = await this.blockchainService.queryBlockchain('conversation')
    datas.forEach(async (data) => {
      let d = new Conversation(data.data.json)
      await d.save()
      //console.log("Restored WalletDeposit", d.name)
    })
    return datas
  }

  async restorePropositions(){
    let datas = await this.blockchainService.queryBlockchain('proposition')
    datas.forEach(async (data) => {
      let d = new Proposition(data.data.json)
      await d.save()

      let offer = await Offer.findOne({ _id : d.offer })
      offer.status = 'PAID'
      await offer.save()
      
      console.log("Restored Proposition", d._id)
    })
    return datas
  }

  async restoreUserDeleted(){

    let managerService = new ManagerService()
    
    let usersB = await this.blockchainService.queryBlockchain('userBanned')
    for await (let data of usersB)  {
      let user = await User.findOne({ _id : data.data.json._id })
                            .populate("walletMain")
                            .populate("walletsDeposit")
                            .populate("plan")
                            
      await managerService.deleteUser(user, true, false)
    }

    let usersD = await this.blockchainService.queryBlockchain('userDeleted')
    for await (let data of usersD)  {
      let user = await User.findOne({ _id : data.data.json._id })
                            .populate("walletMain")
                            .populate("walletsDeposit")
                            .populate("plan")

      await managerService.deleteUser(user, false, false)
    }
    return usersB.concat(usersD)
  }

  async restoreReports(){
    let datas = await this.blockchainService.queryBlockchain('report')
    datas.forEach(async (data) => {
      let d = new Report(data.data.json)
      await d.save()

      let offer = await Offer.findOne({ _id : d.offer })
      offer.status = 'LOCKED'
      await offer.save()
      
      console.log("Restored Proposition", d._id)
    })
    return datas
  }

  async restoreTransactions(){
    let datas = await this.blockchainService.queryBlockchain('transactionFrom')
    let stateHistory = await this.blockchainService.queryBlockchain('statehistory')

    for await (let data of datas)  {
      let trans = data.data.json
      //console.log("Restore Transaction", trans.id, "<<")
      
      let fromW = await this.getWalletByUid(trans.fromWallet.uid)
      let toW = await this.getWalletByUid(trans.toWallet.uid)

      //####### TO_WALLET
      let newTransactions = await this.getNewDailyTrans(toW, trans, stateHistory)
      let nTrans = toW.transactions

      if(toW.type == "MAIN"){
        //ajoute les DAILY manquant
        newTransactions.forEach((newTrans) => {
          nTrans.unshift(newTrans)
          toW.amountUnity += newTrans.amountUnity
          toW.amountMony += newTrans.amountMony
        })
      }
      nTrans.unshift(trans)
      toW.transactions = nTrans

      if(toW.type == "MAIN") toW.amountUnity += trans.amountUnity
      toW.amountMony += trans.amountMony

      toW.markModified("transactions")
      await toW.save()

      //####### FROM_WALLET
      //pareil pour le wallet qui envoie
      if(fromW != null){

        let newTransactions = await this.getNewDailyTrans(fromW, trans, stateHistory)
        let nTrans = fromW.transactions
        if(fromW.type == "MAIN"){
          //console.log("fromW.transactions.unshift ?", newTransactions.length)
          //ajoute les DAILY manquant
          newTransactions.forEach((newTrans) => {
            nTrans.unshift(newTrans)
            fromW.amountUnity += newTrans.amountUnity
            fromW.amountMony += newTrans.amountMony
          })
        }
        fromW.transactions = nTrans
        fromW.transactions.unshift(trans)

        if(fromW.type == "MAIN") fromW.amountUnity -= trans.amountUnity
        fromW.amountMony -= trans.amountMony

        fromW.markModified("transactions")
        await fromW.save()
      }
      //console.log("Restore Transaction", trans.id, ">>")
    }

    await this.addLastDailyTrans(stateHistory)
    //console.log("lastTransactions", lastTransactions.length)

    return datas
  }

  async getNewDailyTrans(toWT, trans, stateHistory){
    if(trans == null) return []
    if(toWT.type != "MAIN") return []
    
    let dateLastTrans = toWT.transactions.length > 0 ? new Date(toWT.transactions[0].created) : true
    if(dateLastTrans == true) return []

    let dateNewTrans = new Date(trans.created)
    
    let newTransactions = []
    if(dateLastTrans < dateNewTrans){
      stateHistory.forEach((block, iState) => {
        let stateHist = block.data.json
        let currentStateDate = new Date(stateHist.date)
        let mConvert = (iState>0) ? stateHistory[iState-1].data.json.monyConvertValue : stateHist.monyConvertValue
        //console.log("stateHistory mConvert", mConvert)
        
        if(dateLastTrans < currentStateDate && currentStateDate < dateNewTrans){
          //console.log("DATES3 NEW DAILY!")
          let amountMony = 1
          let amountUnity = this.convertMonyUnity(amountMony, mConvert)
          let id = 'DAILY' + new ObjectID() 
          let transaction = {
            id: id,
            type: 'create',
            amountUnity: amountUnity,
            amountMony: amountMony,
            monyConvertValue: mConvert, 
            nextMonyConvertValue: stateHist.monyConvertValue, 
            created: currentStateDate
          }
          newTransactions.push(transaction)
        }
      })
    }
    //console.log("newTransactions", newTransactions.length)
    return newTransactions
  }

  async addLastDailyTrans(stateHistory){
    let wallets = await WalletMain.find()
    
    wallets.forEach(async (wallet) => {
      let dateLastTrans = wallet.transactions.length > 0 ? new Date(wallet.transactions[0].created) : true
    
      let newTransactions = wallet.transactions
      stateHistory.forEach(async (block, iState) => {
        let stateHist = block.data.json
        let currentStateDate = new Date(stateHist.date)
        let mConvert = (iState>0) ? stateHistory[iState-1].data.json.monyConvertValue : stateHist.monyConvertValue
        //console.log("stateHistory mConvert", mConvert, wallet.uid)
        
        if(dateLastTrans < currentStateDate){
          //console.log("Restored Transaction Last DAILY")
          let amountMony = 1
          let amountUnity = this.convertMonyUnity(amountMony, mConvert)
          let id = 'DAILY' + new ObjectID() 
          let transaction = {
            id: id,
            type: 'create',
            amountUnity: amountUnity,
            amountMony: amountMony,
            monyConvertValue: mConvert, 
            nextMonyConvertValue: stateHist.monyConvertValue, 
            created: currentStateDate
          }
          newTransactions.unshift(transaction)

          wallet.amountUnity += amountUnity
          wallet.amountMony += amountMony
        }
      })
      wallet.transactions = newTransactions
      wallet.markModified("transactions")
      wallet.markModified("amountUnity")
      wallet.markModified("amountMony")
      await wallet.save()
    })
  }

}
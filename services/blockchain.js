const config = require('config')


let multichain = require("multinodejs")({
    port: config.multichain.port,
    host: config.multichain.host,
    user: config.multichain.user,
    pass: config.multichain.pass
  });
  

module.exports = class BlockchainService {

  constructor() {}

  async saveTransaction(transaction){
    //console.log("saveTransaction", config.multichain)
    if(!config.multichain.active) return
    //ne pas enregistrer les transactions dans la blockchain si le type n'est pas "exchange"
    //(type == create) == création monétaire
    if(transaction.type == "exchange"){
        this.publishToStream(transaction, transaction.fromWallet.id, 'transactionFrom')
        this.publishToStream(transaction, transaction.toWallet.id, 'transactionTo')
    }

  }

  async saveOffer(offer){
    //console.log("saveOffer", config.multichain)
    if(!config.multichain.active) return
    this.publishToStream(offer, offer._id, 'offer')
  }

  async saveUser(user){
    //console.log("saveOffer", config.multichain)
    if(!config.multichain.active) return
    this.publishToStream(user, user._id, 'user')
  }

  async saveWalletMain(wallet){
    //console.log("saveWalletMain", wallet)
    if(!config.multichain.active) return

    wallet.owner = wallet.owner._id
    this.publishToStream(wallet, wallet._id, 'walletMain')
  }

  async saveWalletDeposit(wallet){
    //console.log("saveWalletDeposit", wallet)
    if(!config.multichain.active) return

    wallet.owner = wallet.owner._id
    this.publishToStream(wallet, wallet._id, 'walletDeposit')
  }

  async saveStateHistory(stateH){
    //console.log("saveStateHistory", stateH)
    if(!config.multichain.active) return
    this.publishToStream(stateH, stateH._id, 'stateHistory')
  }

  async saveConversation(conv){
    //console.log("saveConversation", conv)
    if(!config.multichain.active) return
    this.publishToStream(conv, conv._id, 'conversation')
  }
  
  async saveProposition(prop){
    //console.log("saveProposition", prop)
    if(!config.multichain.active) return
    this.publishToStream(prop, prop._id, 'proposition')
  }
  
  async saveReport(report){
    //console.log("saveProposition", prop)
    if(!config.multichain.active) return
    this.publishToStream(report, report._id, 'report')
  }
  
  async saveUserDeleted(user){
    //console.log("saveProposition", prop)
    if(!config.multichain.active) return
    this.publishToStream(user, user._id, 'userDeleted')
  }
  
  async saveUserBanned(user){
    //console.log("saveProposition", prop)
    if(!config.multichain.active) return
    this.publishToStream(user, user._id, 'userBanned')
  }
  
  async publishToStream(data, key, streamName){
    //console.log("publishToStream", data, key, streamName)
    await multichain.publish({  stream: streamName, 
                                key: key, 
                                data: { "json": data },
                                options: ''
                            })
                            .catch((e)=>{
                                console.log("*** Error in multichain saveTransaction()")
                                console.log("*** try to publish to stream : ", streamName)
                                console.log(e)
                                return { error: true, e: e }
                            })
    return { error: false }
  }

  async getLastTransactions(){

    try{
        let transFrom = await multichain.listStreamItems({ stream: 'transactionFrom', count: 50 })
        let transTo = await multichain.listStreamItems({ stream: 'transactionTo', count: 50 })
        
        let transactions = []
        transFrom.forEach((t1) => {
            transTo.forEach((t2) => {
                if(t1.data.json.id == t2.data.json.id) 
                    transactions.push({ t1: t1.data.json, t2: t2.data.json })
            })
        })
        
        let countFrom = (await multichain.listStreamItems({ stream: 'transactionFrom' })).length
        let countTo = (await multichain.listStreamItems({ stream: 'transactionFrom' })).length

        //console.log("stream info", countFrom, "-", countTo)
        return { error: false, 
                 transactions: transactions.reverse(),
                 countFrom: countFrom,
                 countTo: countTo }

    }catch(e){
        console.log("*** Error in multichain getLastTransactions()", e)
        return { error: true, e: e }
    }
  }

  async queryBlockchain(streamName, limit, query){
    let params = { stream: streamName }
    if(limit != null) params.count = limit 
    else params.count = 100000000

    let datas = await multichain.listStreamItems(params)
    return datas
  }

}









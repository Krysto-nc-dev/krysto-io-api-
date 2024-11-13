var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth")
const config = require('config')

const { User } = require('../models/User')
const { Offer } = require('../models/Offer')
const { Conversation } = require('../models/Conversation')

const ConversationService = require('../services/conversation')
const MailCoreService = require('../services/mailcore')
const BlockchainService = require('../services/blockchain')

router.get('/get-conversation/:userId/:offerId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/get-conversation", req.params)

  //vérifie si l'annonce existe
  let offer = await Offer.findOne({ _id: req.params.offerId })
  if(offer == null) return res.send({ error: true })

  let myUserId = req.user._id

  let conv =
  await Conversation.findOne({ 
    '$or' : [{ '$and' : [{ user1: req.params.userId }, { user2: myUserId } ] },
             { '$and' : [{ user2: req.params.userId }, { user1: myUserId } ] }
            ],
    'offer' :  req.params.offerId,
  }) 
  .populate({ path: "user1", select: ["_id", "name", "city"] })
  .populate({ path: "user2", select: ["_id", "name", "city"] })
  .populate({ path: "offer" })
  
  let lastDate = null
  if(conv == null){
    const date = new Date()
    lastDate = date 

    conv = new Conversation()
    conv.user1 = myUserId
    conv.user2 = req.params.userId
    conv.offer = req.params.offerId
    conv.messages = []
    conv.dateLastRead = [{ userId: myUserId, date: date },
                         { userId: req.params.userId, date: date }]
    await conv.save()

    let blockchainService = new BlockchainService()
    await blockchainService.saveConversation(conv)

    let userContact = await User.findOne({ _id: req.params.userId })
    let userMe = await User.findOne({ _id: req.user._id })

    //conv = await Conversation.findOne({ _id: newConv._id })
  }
  else{
    let lastDates = conv.dateLastRead
    lastDates.forEach((item, i) => {
      if(item.userId == myUserId){
        lastDate = lastDates[i].date
        lastDates[i].date = new Date()
      }
    })

    await Conversation.updateOne({ _id : conv._id }, 
                                 { dateLastRead : lastDates } )
  }

  conv = await Conversation.findOne({ 
    '$or' : [{ '$and' : [{ user1: req.params.userId }, { user2: myUserId } ] },
              { '$and' : [{ user2: req.params.userId }, { user1: myUserId } ] }
            ],
    'offer' :  req.params.offerId,
  }) .populate({ path: "user1", select: ["_id", "name", "city"] })
     .populate({ path: "user2", select: ["_id", "name", "city"] })
     .populate({ path: "offer" })

  //console.log("conv", conv.dateLastRead)
  return res.send({ error: false, conversation: conv, lastDate: lastDate })
})

//enregistrer qu'un utilisateur a lu une conversation
router.get('/read-conversation/:convId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/read-conversation", req.params)

  let myUserId = req.user._id

  let conv = await Conversation.findOne({ _id : req.params.convId,
                                          '$or' : [{ user1: myUserId }, 
                                                   { user2: myUserId }]
                                        })
  
  if(conv == null) return res.send({ error: true })
  
  let lastDates = conv.dateLastRead
  lastDates.forEach((item, i) => {
    if(item.userId == myUserId)
      lastDates[i].date = new Date()
  })

  await Conversation.updateOne({ _id : req.params.convId }, { dateLastRead : lastDates } )
  conv = await Conversation.findOne({ _id : req.params.convId })
                          .populate({ path: "user1", select: ["_id", "name", "city"] })
                          .populate({ path: "user2", select: ["_id", "name", "city"] })

  return res.send({ error: false, conversation: conv })
})


router.post('/close-conversation/:convId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/close-conversation", req.params)

  let myUserId = req.user._id

  let conv = await Conversation.findOne({ _id : req.params.convId,
                                          '$or' : [{ user1: myUserId }, 
                                                   { user2: myUserId }]
                                        })
  
  if(conv == null) return res.send({ error: true })

  const receiverId = (conv.user1 != req.user._id) ? conv.user1 : conv.user2
  
  await Conversation.deleteOne({ _id : req.params.convId } )

  req.ws.emit(receiverId, "deleted-conversation", { convId: req.params.convId })

  return res.send({ error: false })
})

router.post('/send-message/:convId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/send-message", req.params, req.body)

  let myUser = await User.findOne({ _id: req.user._id })

  let conv = await Conversation.findOne({ _id: req.params.convId,
                                          '$or': [{ user1: myUser._id }, 
                                                  { user2: myUser._id } ] }) 
              
  if(conv == null) return res.send({ error: true })
  
  const date = new Date()
  const msg = {
    convId: conv._id,
    senderId: myUser._id,
    senderName: myUser.name,
    message: req.body.message,
    created: date,
    updated: date
  }

  conv.messages.push(msg)
  conv.markModified("messages")

  if(conv.dateLastRead.length > 0){
    conv.dateLastRead.forEach((item) => {
      if(item.userId == myUser._id)
        item.date = date
    })
  }else{
    conv.dateLastRead.push({ userId:myUser._id , date: date })
  }
  conv.markModified("dateLastRead")

  conv.updated = date
  await conv.save()

  const receiverId = (conv.user1 != req.user._id) ? conv.user1 : conv.user2

  req.ws.emit(receiverId, "new-private-msg", { newMsg: msg, offerId: conv.offer })

  let receiverUser = await User.findOne({ _id: receiverId })

  //console.log("sendMailByTemplate ? newDiscussion", conv.messages.length)
  if(receiverUser != null && conv.messages.length == 1){
    //console.log("req.params.userId", req.params.userId)

    //envoi un mail de notif pour signaler le début d'une nouvelle conversation
    //console.log("sendMailByTemplate newDiscussion")
    const mailCoreService = new MailCoreService()

    let { mailRes, emailParams } = 
          await mailCoreService.sendMailByTemplate(receiverUser, 'user', 'newDiscussion', 
                                                  { offerId : conv.offer._id,
                                                    userContactName: receiverUser.name })
        //console.log("sendMailByTemplate newDiscussion ok",  mailRes, emailParams)
        return res.send({ error: false, message: msg, mailRes, emailParams })
  }

  return res.send({ error: false, message: msg })
})

router.post('/edit-message/:convId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/edit-message", req.params, req.body)

  let conv = await Conversation.findOne({ _id: req.params.convId,
                                          '$or': [{ user1: req.user._id }, 
                                                  { user2: req.user._id } ] }) 
              
  if(conv == null) return res.send({ error: true })
  
  const date = new Date()
  if(conv.messages[req.body.inx] != null
  && conv.messages[req.body.inx].senderId == req.user._id)
  {
     conv.messages[req.body.inx].message = req.body.message
     conv.messages[req.body.inx].updated = date
  }
  
  conv.markModified("messages")
  await conv.save()

  const receiverId = (conv.user1 != req.user._id) ? conv.user1 : conv.user2

  req.ws.emit(receiverId, "edited-private-msg", 
                { newMsg: conv.messages[req.body.inx],
                  offerId: conv.offer,
                  inx: req.body.inx
                })

  return res.send({ error: false, message: conv.messages[req.body.inx].message })
})

router.post('/delete-message/:convId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/private/delete-message", req.params, req.body)
  
  let conv = await Conversation.findOne({ _id: req.params.convId,
                                        '$or': [{ user1: req.user._id }, 
                                                { user2: req.user._id } ] }) 
              
  if(conv == null) return res.send({ error: true })
  
  if(conv.messages[req.body.inx] != null
  && conv.messages[req.body.inx].senderId == req.user._id)
    conv.messages.splice(req.body.inx, 1)
  else 
    return res.send({ error: true, msg: "ce message n'existe pas" })
    
  conv.markModified("messages")
  await conv.save()

  const receiverId = (conv.user1 != req.user._id) ? conv.user1 : conv.user2

  req.ws.emit(receiverId, "deleted-private-msg", 
                            { senderId: req.user._id, 
                              offerId: conv.offer,
                              inx: req.body.inx 
                            })

  return res.send({ error: false })
})

module.exports = router;
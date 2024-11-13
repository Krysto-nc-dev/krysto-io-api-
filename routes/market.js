var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth")
const config = require('config')

const MarketService = require('../services/market')
//const OtoService = require('../services/oto')
const AdminService = require('../services/admin')
const MailCoreService = require('../services/mailcore')

const { User } = require('../models/User')
const { Offer } = require('../models/Offer')
const { Proposition } = require('../models/Proposition')
const { Nego } = require('../models/Nego')

var multer  = require('multer')


router.post('/create-offer', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/create-offer")

  //si le user n'a pas payé son abonnement : 
  //il n'a pas le droit d'envoyer des propositions sur les annonces
  let user = await User.findOne({ _id: req.user._id })
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })

  let marketService = new MarketService()
  const offer = await marketService.saveOffer(req.body, req.user._id)
  
  return res.send({ error: false, offer: offer })
})

router.get('/get-offer/:offerId',  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/get-offer")
  
  let offer = await Offer.findOne({ _id: req.params.offerId })
                         .populate({ path: 'propositions', populate: { path : 'negos' }})
                         .populate({ path: 'creator',
                                    select: ['_id', 'name']
                                  })
  
  return res.send({ error: offer == null, offer: offer })
})

router.post('/edit-offer', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/edit-offer")

  //si le user n'a pas payé son abonnement : 
  //il n'a pas le droit d'envoyer d'éditer une annonce'
  let user = await User.findOne({ _id: req.user._id })
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })

  let marketService = new MarketService()
  const offer = await marketService.editOffer(req.body, req.user._id)
  
  return res.send({ error: false, offer: offer })
})

//accessible for all : no middlware
router.post('/search',  async (req, res) => {
  console.log("--------------------------------")
  console.log("/market/search", req.body)

  try{
      
    let marketService = new MarketService()
    const result = await marketService.searchOffer(req.body)

    return res.send(result)
  }
  catch(e){
    console.log("ERROR /market/search")
    console.log(e)
  }
})

router.post('/send-proposition', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/send-proposition")

  //si le user n'a pas payé son abonnement : 
  //il n'a pas le droit d'envoyer des propositions sur les annonces
  let user = await User.findOne({ _id: req.user._id })

  if(user == null)
    return res.send({ error: true, msg: 'User not found' })
  
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })
  
  try{
    let marketService = new MarketService()
    const result = await marketService.sendProposition(req.body, user)
    //envoi la notification au créateur de l'annonce
    if(result.error == false) {
      req.ws.emit(result.offer.creator._id, "new-proposition", { })
    }

    res.send(result)
  }catch(e){
    console.log("crash error", e)
  }
})


router.post('/send-answer', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/send-answer")

  //si le user n'a pas payé son abonnement : 
  //il n'a pas le droit d'envoyer de réponses
  let user = await User.findOne({ _id: req.user._id })
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })

  let proposition = await Proposition.findOne({ _id: req.body.propositionId })
                                     .populate("negos")
                                     .populate('offer')
  
  if(proposition.offer.creator != req.user._id)
    return res.send({ error: true, msg: "You are not the creator of this offer" })


  let lastNego = proposition.negos[proposition.negos.length - 1]

  let nego = await Nego.findOne({ _id: lastNego._id })

  nego.status = req.body.type
  nego.answerTxt = req.body.text
  nego.updated = new Date()
  await nego.save()

  if(req.body.type == 'ACCEPTED') {
    proposition.offer.status = "RESERVED"
    await proposition.offer.save()
  }

  //envoi la notification au créateur de l'annonce
  req.ws.emit(proposition.userCaller, "new-answer", { })
  
  //envoi un mail de notif
  const mailCoreService = new MailCoreService()
  mailCoreService.sendMailByTemplate(proposition.userCaller, 'user', 'newAnswer', { offerId : proposition.offer._id })
  

  return res.send({ error: false, proposition: proposition })
})


router.post('/pay-offer/:offerId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/pay-offer")
  
  let user = await User.findOne({ _id: req.user._id })
  
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })

  let marketService = new MarketService()
  const result = await marketService.payOffer(req.params.offerId, 
                                              req.body.fromWalletUid, 
                                              req.user._id,
                                              req.ws)
  
  return res.send(result)
})

router.post('/delete-offer/:offerId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/delete-offer", req.params.offerId)
  
  let user = await User.findOne({ _id: req.user._id })

  let marketService = new MarketService()
  const result = await marketService.deleteOffer(req.params.offerId, user)
  
  return res.send(result)
})


router.post('/cancel-proposition/:propId', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/delete-offer", req.params.offerId)
  
  let user = await User.findOne({ _id: req.user._id })

  let marketService = new MarketService()
  const result = await marketService.cancelProposition(req.params.propId, user)
  
  return res.send(result)
})



/** --------------------- UPLOAD IMAGES --------------------- */

// SET STORAGE
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    //console.log("multer.diskStorage destination")
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    //console.log("multer.diskStorage filename", req.body)
    const match = ["image/png", "image/jpeg"];

    if (match.indexOf(file.mimetype) === -1) {
      var message = `${file.originalname} is invalid. Only accept png/jpeg.`;
      return callback(message, null);
    }

    cb(null, file.fieldname + '-' + Date.now())
  }
})
 
var upload = multer({ storage: storage, 
                      limits: { fileSize: '2MB' } })

router.post('/upload-file-multi', upload.any(),  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/upload-file-multi")

  if(req.body.entityId == null) return res.send({ error: true })

  const entityType = 'offer'
  const attrName = 'gallery'
  const entityId = req.body.entityId
  
  let adminService = new AdminService()
  let entity = await adminService.getFormEntity(entityType, entityId)
  
  if(entity == null) return res.send({ error: true })

  await Promise.all(req.files.map(async (file) => {
    let fileName = await adminService.resizeImg(file)
    if(typeof entity[attrName] == null)
      entity[attrName] = new Array()

    entity[attrName].push(fileName)
  }))
  await entity.markModified(attrName)
  await entity.save()

  res.send({ error: false })
})


router.post('/delete-image-multi', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/market/delete-image-multi")

  if(req.body.entityId == null) return res.send({ error: true })

  const entityId = req.body.entityId
  const entityType = 'offer'
  const attrName = 'gallery'
  const inx = req.body.inx

  let adminService = new AdminService()
  const entities = await adminService.queryEntity(entityType, { _id: entityId })
  let entity = entities[0]
  if(entity == null) return res.send({ error: true, msg: "pas de entity" })

  //efface le fichier de l'image
  await adminService.deleteImgFile(entity[attrName][inx])

  let imgs = entity[attrName]
  imgs.splice(inx, 1)
  entity[attrName] = imgs
  entity.save()

  return res.send({ error: false, entity: entity })
})

module.exports = router;

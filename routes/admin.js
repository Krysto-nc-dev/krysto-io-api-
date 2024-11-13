var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth-admin");

const AdminService = require('../services/admin')
const TranslationService = require('../services/translation')
const OtoService = require('../services/oto')
const UserService = require('../services/user')
const ManagerService = require('../services/manager')
const CaptchaService = require('../services/captcha')
const MailCoreService = require('../services/mailcore')
const BlockchainService = require('../services/blockchain')

const { Instance } = require('../models/Instance')
const { User } = require('../models/User')
const { Offer } = require('../models/Offer')

var multer  = require('multer')

router.get('/api-ready', async (req, res) => {
  res.send({ ready: true })
})

router.get('/entity-types-availables',  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/admin/entity-types-availables", req.params)
  let adminService = new AdminService()
  let entityTypes = await adminService.getEntityTypesAvailables()
  res.send({ error: false, entityTypesAvailables: entityTypes })
})


router.get('/get-form-json/:lang/:entityType/:entityId?', auth,  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/admin/get-form-json", req.params)
  let translationService = new TranslationService()
  let adminService = new AdminService()
  let entity = null
  let eType = req.params.entityType.replace(/^\w/, (c) => c.toUpperCase())
  
  if(req.params.entityId != null) 
    entity = await adminService.getFormEntity(eType, req.params.entityId)
  //sielse
    //res.send({ error: false, msg: 'no entity id provided' })
  
  let formJson = await adminService.getFormJson(req.params.entityType)

  let translations = null
  if(entity != null)
    translations = await translationService.getTranslations(entity, req.params.entityType, formJson)

  //récupère les données pour gérer les liens entre les entités 
  //(ex: afficher toutes les Cities dans un select, pour sélectionner la City d'un Model)
  await Promise.all(formJson.map(async (attr, i) => {
    if(attr.type == "ENTITY"){
      let eType = attr.entityType.replace(/^\w/, (c) => c.toUpperCase())
      let values = await adminService.getFormEntities(eType, attr.query, req.params.lang)
      //console.log("*** populate form", req.params.entityType, attr.entityType)
      formJson[i].values = values
    }
  }))

  res.send({ error: false, formJson: formJson, 
             entity: entity, translations: translations })
})


router.post('/save-entity', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/save-entity", req.body.entityType)

  let entityType = req.body.entityType
  let entityId = req.body.entityId
  let entityData = req.body.entityData
  let translations = req.body.translations

  let adminService = new AdminService()
  let translationService = new TranslationService()
  const { Model, validate, afterCreateByAdmin } = adminService.requireModel(entityType)

  const { error } = validate(req.body.entityData, entityId)
  if (error) return res.send({ error: true, validateErrors: error })

  //si un id est passé en paramètre : récupère l'obj dans la bdd
  //sinon crée un nouvel obj
  let entity = (entityId == null) ? new Model() : await Model.findById(entityId)
  //si pas d'entité trouvé : erreur
  if(entity == null) res.send({ error: true })

  let formJson = await adminService.getFormJson(req.body.entityType)
  //pour chaque attribut envoyé par le formulaire
  for(attrName in entityData){
    //remplace l'ancienne valeur par la nouvelle
    entity[attrName] = entityData[attrName]
  }
  //si c'est un nouvel obj : enregistre la date de création
  if(entityId == null) 
    entity.created = new Date()
  //enregistre toujours la date de modification
  entity.updated = new Date()
  try{
    //enregistre la donnée
    await entity.save()
    //enregistre les traductions s'il y en a
    translationService.saveTranslation(entityType, entity.id, translations, formJson)
  }catch(e){
    const { error } = validate(entity)
    if (error) return res.send({ error: true, validateErrors: error })
  }

  if(entityId == null) 
    await afterCreateByAdmin(entity)

  //console.log("/save-entity success")
  res.send({ error: false, entityId: entity.id })
})


router.post('/get-entities/:lang/:entityType/:limit?', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/get-entities/:entityType/:limit", req.body)

  if(req.params.entityType == null)
    return res.send({ error: true })

  let query = {}
  if(req.body.search != null)
    query = {
      '$or' : [
        { "name"  : new RegExp(".*"+req.body.search.toLowerCase().trim(), "i")},
        { "email" : new RegExp(".*"+req.body.search.toLowerCase().trim(), "i")},
        { "text" :  new RegExp(".*"+req.body.search.toLowerCase().trim(), "i")},
        { "title" : new RegExp(".*"+req.body.search.toLowerCase().trim(), "i")},
      ]
    }
  
  let adminService = new AdminService()
  let entities = await adminService.queryEntity(req.params.entityType, query, req.params.limit, req.params.lang, req.params.sort)
  entities = await adminService.stringifyPopulated(req.params.entityType, entities)

  return res.send({ error: false, entities: entities })
})


router.post('/delete-entity', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/admin/delete-entity", req.body.id)

  if(req.body.entityType == null) return res.send({ error: true })

  let adminService = new AdminService()
  const resDelete = await adminService.deleteEntity(req.body.entityType, req.body.id)
  return res.send({ error: !resDelete })
})


router.post('/query-entities', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/query-entities", req.body)

  if(req.body.entityType == null) return res.send({ error: true })

  let adminService = new AdminService()
  const entities = await adminService.queryEntity(req.body.entityType, 
                                                  req.body.query, 
                                                  req.body.limit, 
                                                  req.body.lang, 
                                                  req.body.sort)
  
  return res.send({ error: false, entities: entities })
})

router.post('/query-blockchain', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/query-blockchain", req.body)

  if(req.body.streamName == null) return res.send({ error: true })

  let blockchainService = new BlockchainService()
  const entities = await blockchainService.queryBlockchain(req.body.streamName, 
                                                          req.body.limit, 
                                                          req.body.query, 
                                                          //req.body.sort
                                                          )
  //console.log("/admin/query-blockchain RES entities", entities.length)
  return res.send({ error: false, entities: entities })
})

router.post('/restore-from-blockchain', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/admin/query-blockchain", req.body)

  let otoService = new OtoService()
  await otoService.restoreFromBlockchain()
  
  return res.send({ error: false })
})

router.get('/reboot-bdd/:rootPk', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/admin/reboot-bdd", req.params)

  let otoService = new OtoService()
  const result = await otoService.raz()
 
  return res.send({ error: false, result: result })
  
})

router.get('/create-dev-data/:rootPk', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/admin/create-dev-data", req.params)

  let userService = new UserService()
  const result = await userService.createDevData()
 
  console.log("userService.createDevData", result)
  return res.send({ error: false, result: result })
  
})

router.get('/get-db-stats', auth,  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/admin/get-db-stats", req.params)

  let stats = {}

  let adminService = new AdminService()
  let entityTypes = await adminService.getEntityTypesAvailables()

  entityTypes = entityTypes.concat(["proposition", "nego"])  
  await Promise.all(entityTypes.map(async (eType) =>  {
    let { Model } = await adminService.requireModel(eType)
    stats[eType] = await Model.countDocuments()
  }));


  stats['user'] = await User.countDocuments({ isActive: true, 
                                              isLocked: false,
                                              walletMain: { $ne : null }  })

  let i = await Instance.findOne({ name: "main" })
  stats["unityTotal"] = i != null ? i.unityTotal : 0
   
  return res.send({ error: false, stats: stats })
})

//renvoyer le mail qui permet de vérifier son adresse e-mail (via l'admin)
router.post('/resend-email-validation', auth, async (req, res) => {
  //find an existing user by email
  let user = await User.findOne({ _id: req.body.userId })
  //erreur si le user n'est pas trouvé
  if (!user) return res.json({ error: true, msg: "USER_NOT_EXISTS" })

  //si pas d'erreur : envoie le mail
  const mailCoreService = new MailCoreService()
  let { mailRes, emailParams } = await mailCoreService.sendMailByTemplate(user, 'user', 'createAccount')
  return res.json({ error: false, user: user, mailRes, emailParams })
});


//bannir un utilisateur (bloquer l'email pour empêcher de créer un nouveau compte avec cette adresse)
router.post('/ban-user', auth, async (req, res) => {
  
  let user = await User.findOne({ _id: req.body.userId })
                        .populate("walletMain")
                        .populate("walletsDeposit")
                        .populate("plan")

  //erreur si le signalement n'est pas trouvé
  if (!user) return res.json({ error: true, msg: "USER_NOT_EXISTS" })

  //console.log("ready to delete user", user.name, user._id)
  //si pas d'erreur : envoie le mail
  const managerService = new ManagerService()
  let resMail = await managerService.deleteUser(user, true) //true = onlyBan

  //TODO : rajouter l'envoi d'un socket pour deconnecter le user s'il est connecté

  return res.json({ error: false, emailParams: resMail.emailParams })
});


//envoie le mail à l'admin principal de la plateforme (mail défini dans la config)
router.post('/send-mail-contact', async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/send-mail-contact")
  //vérification du captcha
  const captchaService = new CaptchaService()
  let resultCaptcha = await captchaService.checkCaptchaAnswer(req.body.captcha.answer, req.body.captcha.sessionid)

  let result = { error: true }

  //si le captcha est correct
  if(resultCaptcha.success == true){
    //envoi le mail de contact
    const mailCoreService = new MailCoreService()
    let mailRes = await mailCoreService.sendMailContact(req.body.message)
    result = { error: false, mailRes: mailRes }
  }else{ //si le captcha est incorrect
    result.errorCaptcha = true
  }
  return res.send(result);
})


//supprime les comptes PREMIUM qui n'ont pas publié d'annonce sous 7 jours
//:rootPk? pour le cron
router.post('/delete-past-premium/:rootPk?', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/delete-past-premium")
  let userService = new UserService()
  let nbDeleted = await userService.deletePastPremium()
  
  return res.send({ error: false, nbDeleted : nbDeleted })
})


//envoyer un mail à tous les user PREMIUM qui n'ont pas publié d'annonce depuis X jours
//:rootPk pour le cron
router.get('/mail-past-premium/:nbDays/:rootPk', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/delete-past-premium")
  let userService = new UserService()
  let nbMailed = await userService.mailPastPremium(req.params.nbDays)
  
  return res.send({ error: false, nbMailed : nbMailed })
})


/** --------------------- UPLOAD IMAGES --------------------- */

// SET STORAGE
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    //console.log("multer.diskStorage destination")
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    console.log("multer.diskStorage filename", req.body)
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

router.post('/upload-file', upload.single('image'),  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/upload-file")

  let adminService = new AdminService()
  let entity = await adminService.getFormEntity(req.body.entityType, req.body.entityId)
  if(entity == null) return res.send({ error: true })
  
  let fileName = await adminService.resizeImg(req.file)
  
  //efface l'ancienne image s'il y en a une 
  if(entity[req.body.attrName] != null) 
    await adminService.deleteImgFile(entity[req.body.attrName])

    await adminService.cpToOriginalName(fileName, req.file.originalname)


  entity[req.body.attrName] = fileName
  await entity.save()

  res.send({ error: false })
})

router.post('/upload-file-multi', upload.any(),  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/upload-file-multi")

  let adminService = new AdminService()
  let entity = await adminService.getFormEntity(req.body.entityType, req.body.entityId)
  
  if(entity == null) return res.send({ error: true })

  await Promise.all(req.files.map(async (file) => {
    let fileName = await adminService.resizeImg(file)
    if(typeof entity[req.body.attrName] == null)
      entity[req.body.attrName] = new Array()

    entity[req.body.attrName].push(fileName)
  }))
  await entity.markModified(req.body.attrName)
  await entity.save()

  res.send({ error: false })
})

router.post('/delete-image', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/delete-image", req.body)

  if(req.body.entityType == null) return res.send({ error: true })

  let adminService = new AdminService()
  const entities = await adminService.queryEntity(req.body.entityType, { _id: req.body.entityId })
  let entity = entities[0]
  if(entity == null) return res.send({ error: true })

  //efface le fichier de l'image
  await adminService.deleteImgFile(entity[req.body.attrName])

  entity[req.body.attrName] = null 
  entity.save()

  return res.send({ error: false, entity: entity })
})


router.post('/delete-image-multi', auth,  async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/admin/delete-image-multi", req.body)

  if(req.body.entityType == null) return res.send({ error: true })

  let adminService = new AdminService()
  const entities = await adminService.queryEntity(req.body.entityType, { _id: req.body.entityId })
  let entity = entities[0]
  if(entity == null) return res.send({ error: true })

  //efface le fichier de l'image
  await adminService.deleteImgFile(entity[req.body.attrName][req.body.inx])

  let imgs = entity[req.body.attrName]
  imgs.splice(req.body.inx, 1)
  entity[req.body.attrName] = imgs
  entity.save()

  return res.send({ error: false, entity: entity })
})


// router.get('/inverse-coords-offer', auth,  async (req, res) => {
//   //console.log("--------------------------------")
//   console.log("/admin/inverse-coords-offer")

//   let offers = await Offer.find()

//   offers.forEach((offer) => {
//     console.log("/admin/inverse-coords-offer coords1", offer.coordinates)

//     if(offer.coordinates[0] <= 90 
//     && offer.coordinates[1] <= 180
//     && offer.coordinates[0] >= -90 
//     && offer.coordinates[1] >= -180)
//        offer.coordinates = [offer.coordinates[1], offer.coordinates[0]]

//     console.log("/admin/inverse-coords-offer coords2", offer.coordinates)
//     offer.save()
//   })

//   return res.send({ error: false })
// })

module.exports = router;
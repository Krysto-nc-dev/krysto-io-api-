var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth")
const config = require('config')

const { User } = require('../models/User')
const { Instance } = require('../models/Instance')

const AdminService = require('../services/admin')
const CaptchaService = require('../services/captcha')

//accessible for all : no middlware
router.post('/query-entities',  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/data/query-entities", req.body)

  if(req.body.entityType == null) 
    return res.send({ error: true, msg: "entityType is null : Merci de préciser le type de données que vous souhaitez consulter" })

  //forbidenTypes : liste des type de données auxquels on n'a pas accès via cet api
  //comme il n'y a pas de middleware, ce endpoint est accessible à tout le monde
  //il ne faut pas que tout le monde ait accès à notre liste de user par ex
  let forbidenTypes = ["user", "walletMain", "walletDeposit"]
  if(forbidenTypes[req.body.entityType] != null) 
    return res.send({ error: true, msg: "Vous n'êtes pas autorisé à consulter ce type de donnée : " + req.body.entityType })

  let adminService = new AdminService()
  const entities = await adminService.queryEntity(req.body.entityType, req.body.query, 
                                                  req.body.limit, req.body.lang, req.body.sort)
  
  return res.send({ error: false, entities: entities })
})

router.post('/get-lang-availables',  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/data/get-lang-availables")

  return res.send({ languages: config.get('languages') })
})

router.post('/get-nb-users-total',  async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/data/get-nb-users-total")

  let nb = await User.countDocuments()

  let i = await Instance.findOne({ name: 'main' })
  
  return res.send({ nbUsers: nb, 
                    limitForFreePlan: i != null ? i.limitForFreePlan : 10000 })
})


//envoie le mail à l'admin principal de la plateforme (mail défini dans la config)
router.get('/new-captcha-session', async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/data/new-captcha-session", req.body)
  
  const captchaService = new CaptchaService()
  let result = await captchaService.newCaptchaSession()
  
  return res.send(result)
})

//envoie le mail à l'admin principal de la plateforme (mail défini dans la config)
router.post('/check-captcha-answer', async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/data/check-captcha-answer", req.body.sessionid)

  const captchaService = new CaptchaService()
  let result = await captchaService.checkCaptchaAnswer(req.body.answer, req.body.sessionid)

  console.log("Captcha result", result)
  res.send(result)
})


module.exports = router;
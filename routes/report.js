var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth")
const authAdmin = require("../middleware/auth-admin")
const config = require('config')

const { User } = require('../models/User')
const { Report } = require('../models/Report')
const { Offer } = require('../models/Offer')

const ReportService = require('../services/report')
const BlockchainService = require('../services/blockchain')

router.post('/send', auth, async (req, res) => {
  console.log("--------------------------------")
  console.log("/report/send", req.body)

  let offer = await Offer.findOne({ _id: req.body.offerId })
  if(offer == null)
    return res.send({ error: true, msg: 'User not found' })

  let user = await User.findOne({ _id: req.user._id })

  let reportService = new ReportService()
  await reportService.send(req.body, user, offer)
  
  return res.send({ error: false })
})

//annulation d'un signalement
router.post('/cancel', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/report/cancel", req.body)

  let report = await Report.findOne({ _id: req.body.reportId })
  if(report == null)
    return res.send({ error: true, errorMsg: 'Report not found' })

  let offer = await Offer.findOne({ _id: report.offer })
  offer.reports = []
  offer.markModified('reports')
  await offer.save()
  
  await Report.deleteOne({ _id: req.body.reportId })
  
  return res.send({ error: false })
})

//bloquage d'une annonce suite à un signalement
router.post('/lock-offer', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/report/lock-offer", req.body)

  let report = await Report.findOne({ _id: req.body.reportId })
  if(report == null)
    return res.send({ error: true, errorMsg: 'Report not found' })

  let offer = await Offer.findOne({ _id: report.offer._id })
  offer.status = "LOCKED"
  await offer.save()
  
  report.status = "CLOSED"
  await report.save()
  
  //await Report.deleteOne({ _id: req.body.reportId })

  let blockchainService = new BlockchainService()
  blockchainService.saveReport(report)

  return res.send({ error: false })
})


module.exports = router;
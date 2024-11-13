var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth")
const authAdmin = require("../middleware/auth-admin")
const config = require('config')

const { User } = require('../models/User')
const { StatUrl } = require('../models/StatUrl')
const { StateHistory } = require('../models/StateHistory')

const StatService = require('../services/stat')


router.post('/inc-stat-url',  async (req, res) => {
  //console.log("-------------------------")
  //console.log("++++++++ /stat/inc-stat-url", req.body.url, req.body.domaineName)

  if(req.body.url == null) return res.json({ error: true })

  let date1D = new Date()
  date1D.setDate(date1D.getDate() - 1)

  let query = { url: req.body.url, 
                clientDomaineName: req.body.domaineName,
                date: { '$gt': date1D } }

  let stat = await StatUrl.findOne(query)

  //console.log("query", query, stat)

  if(stat == null){
      //console.log("+ Error: no state inited for current date")
      //console.log("+ Try to init it")
      let statService = new StatService()
      statService.initDayStat()
      //console.log("+ State is now inited for current date, and checked for 50 days")
      return res.json({ error: false })
  }else{
      let date = new Date()
      stat.lastDate = date
      stat.count = stat.count + 1
      stat.save()
      //console.log("++++++++ IncStat", req.body.url, stat.count)
      return res.json({ error: false })
  }
})


router.get('/get-stat-url/:domaineName', authAdmin,  async (req, res) => {
  //console.log("-------------------------")
  //console.log("/stat/get-stat-url", req.params.domaineName)

  let date30D = new Date()
  date30D.setDate(date30D.getDate() - 30)

  let stats = await StatUrl.find({ clientDomaineName: req.params.domaineName, 
                                   date: { '$gt': date30D } })
                              .sort({'inx':-1})

  //console.log("/stat/get-stat-url nbStats:", stats.length)
  
  //stats = stats.reverse()

  return res.json({ error: false, stats: stats })
})


router.get('/get-state-history', authAdmin,  async (req, res) => {
  //console.log("-------------------------")
  //console.log("/stat/get-state-history")

  try{
      let stateHistory = await StateHistory.find().limit(30).sort({ 'date' : -1 })
      stateHistory = stateHistory.reverse()
      res.json({ error: false, stateHistory: stateHistory })
  }catch(e){
      console.log("error /stat/get-state-history", e)
      res.json({ error: true })
  }
})

module.exports = router;
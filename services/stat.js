const config = require('config')
const { User } = require('../models/User')
const { WalletMain } = require('../models/WalletMain')
const { WalletDeposit } = require('../models/WalletDeposit')
const { Offer } = require('../models/Offer')
const { Report } = require('../models/Report')
const { StatUrl } = require('../models/StatUrl')
const { Instance } = require('../models/Instance')
const { StateHistory } = require('../models/StateHistory')

module.exports = class StatService {

  constructor() {}
  
  async initDayStat(){

    let date1D = new Date()
    //date1D.setDate(date1D.getDate() - 1)

    //console.log("SERVICE - instance.initDayStat", date1D)
    let nbExist = 0
    let nbTotal = 0
    let urlsEnabled = this.getStatUrlEnabled()

    let nbDays = 1 // = 0 pour aujourd'hui seulement OU >0 pour simuler plusieurs jours
    for(let i = nbDays; i >= 0; i--){
        let day = new Date()
        let today = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 1, 0, 0)
        let dateR = new Date()
        let dateL = new Date()
        dateR.setDate(dateR.getDate() - i)
        dateL.setDate(dateL.getDate() - i - 1)
        console.log("Stats", dateL, dateR, config.get("domainName"))
        await Promise.all(urlsEnabled.map(async (url, x) => {

            //console.log("New stat url", url, dateR.getFullYear(), dateR.getMonth()+1, dateR.getDate())
            let stat = await StatUrl.findOne({  clientDomaineName : config.get("domainName"),
                                                url: url, 
                                                  '$and' : [
                                                    { date: { '$gt': dateL } },
                                                    { date: { '$lt': dateR } },
                                                  ],
                                            }).sort('date')
            
            if(stat == null){
                let rand = 0 //nbDays > 0 ? Math.floor(Math.random() * Math.floor(10)) : 0
                let newStat = new StatUrl()
                let date = new Date(new Date(dateR.getFullYear(), dateR.getMonth(), dateR.getDate(), 1, 0, 0))
                newStat.clientDomaineName = config.get("domainName")
                newStat.date =  date
                newStat.lastDate =  date
                newStat.url = url
                newStat.count = rand
                newStat.inx = x
                await newStat.save()
                console.log("New stat inited", url, newStat.count)
                //return res.json({ error: false })
            }else{
                nbExist++
                //console.log("New stat already exists", url, dateR)
                //return res.json({ error: false, msg: 'This day is already inited for this url', url })
            }
            nbTotal++
        }))
    }
    //console.log("Stats already exists :", nbExist, "/", nbTotal)
  }


  
  getStatUrlEnabled(){
    let u = [
      '/home',
      '/mony',
      //'/g1-vs-krup',
      '/faq',
      '/login',
      '/register',
      '/cgu',
      '/cgv',

      '/market',
      '/offer',
      '/wallet',
      '/private',
      '/publish-offer',
      '/profil'
    ]
    return u.reverse()
  }

  
}
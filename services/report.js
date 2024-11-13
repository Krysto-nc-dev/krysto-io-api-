
const { Report } = require('../models/Report')

module.exports = class OtoService {

  constructor() {
    
  }

  async send(params, user, offer){
    let report = await Report.findOne({ offer: offer._id })

    let date = new Date()
    let reporterExists = false

    //si c'est le premier signalement de cette annonce
    //on créé un nouveau signalement
    if(report == null){
      report = new Report()
      report.offer = offer._id
      report.created = date
    }else{
      //vérifie si l'utilsateur a déjà fait un signalement
      report.reporters.forEach((reporter) => {
        if(reporter.userId.toString() === user._id.toString()) 
          reporterExists = true
      })
    }
    
    if(reporterExists == false){
      //on ajoute l'auteur du signalement dans la liste
      report.reporters.push({ userId: user._id,
                              userName: user.name,
                              flag: params.flag,
                              text: params.text,
                              created: date,
                             })

      report.status = "OPEN"
      report.updated = date
      await report.save()

      //enregistre le signalement sur l'offre
      offer.reports.push(report)
      offer.markModified("reports")
      await offer.save()
    }
  }

  
}
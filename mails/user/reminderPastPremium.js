const config = require('config')
const { User } = require('../../models/User')
const { Email } = require('../../models/Email')


const MailCoreService = require('../../services/mailcore')

module.exports = class MailCreateAccount {

  constructor() {
    this.mailService = new MailCoreService()
  }

  async getEmailData(userId, dataSec){
    let data = await User.findOne({ _id: userId })

    let email = await Email.findOne({ key: "reminderPastPremium" })
    if(email == null) return { error : true, msg : "no email found in bdd" }

    let urlLinkLogin = config.get("domainUrlClient") + "/confirm-email/" + data._id + "/" + data.emailToken
    let btnLogin = this.mailService.getBtnAction(urlLinkLogin, "Se connecter")

    let dateLeft = data.created
    console.log("dateLeft1", dateLeft)
    dateLeft.setDate(dateLeft.getDate() + 30) //30 jours pour publier la premiere annonce
    
    console.log("dateLeft2", dateLeft)
    
    let dateToday = new Date()
    let nbDaysLeft = (dateLeft.getTime() - dateToday.getTime()) / (1000 * 3600 * 24); 
    nbDaysLeft = parseInt(nbDaysLeft);
    
    console.log("dateLeft3", dateLeft)
    console.log("dateToday", dateToday)
    console.log("nbDaysLeft", nbDaysLeft)

    // datePastdays.setDate(datePastdays.getDate() - nbDays)
    // datePastdaysLimit.setDate(datePastdays.getDate() - 1)

    let replaceVal = [
      { key: "userName",  val: data.name },
      { key: "nbDaysLeft",  val: nbDaysLeft },
      { key: "btnLogin", val: btnLogin },
    ]

    let html = await this.mailService.getHtmlBody(email.message, replaceVal)
    let clientEmail = await this.mailService.getClientMail(data)

    return { to: clientEmail,
             from: config.get("email.from.contact"),
             subject: email.subject,
             html: html
            }
  }
}
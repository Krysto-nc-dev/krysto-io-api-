const config = require('config')
const { User } = require('../../models/User')
const { Email } = require('../../models/Email')
const { Offer } = require('../../models/Offer')


const MailCoreService = require('../../services/mailcore')

module.exports = class MailCreateAccount {

  constructor() {
    this.mailService = new MailCoreService()
  }

  async getEmailData(userId, dataSec){
    let data = await User.findOne({ _id: userId })
    let offer = await Offer.findOne({ _id: dataSec.offerId })

    let email = await Email.findOne({ key: "newAnswer" })
    if(email == null) return { error : true, msg : "no email found in bdd" }

    let urlLinkMyAnswers = config.get("domainUrlClient") + "/answers/buyer"
    let btnMyAnswers = this.mailService.getBtnAction(urlLinkMyAnswers, "Voir la réponse")
    
    let replaceVal = [
      { key: "userName",  val: data.name },
      { key: "offerTitle", val: offer.title },
      { key: "btnMyAnswers", val: btnMyAnswers },
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
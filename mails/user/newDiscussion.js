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

    //console.log("goto send mail data", userId, data)
    let email = await Email.findOne({ key: "newDiscussion" })
    if(email == null) return { error : true, msg : "no email found in bdd" }

    let urlLinkDiscussion = config.get("domainUrlClient") + "/login"
    let btnDiscussion = this.mailService.getBtnAction(urlLinkDiscussion, "Voir la discussion")
    
    let replaceVal = [
      { key: "userName",  val: data.name },
      { key: "userContactName",  val: dataSec.userContactName },
      { key: "offerTitle", val: offer.title },
      { key: "btnDiscussion", val: btnDiscussion },
    ]

    let html = await this.mailService.getHtmlBody(email.message, replaceVal)
    let clientEmail = await this.mailService.getClientMail(data)

    //console.log("goto send mail", html)

    return { to: clientEmail,
             from: config.get("email.from.contact"),
             subject: email.subject,
             html: html
            }
  }
}
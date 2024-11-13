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

    let email = await Email.findOne({ key: "createAccount" })
    if(email == null) return { error : true, msg : "no email found in bdd" }

    let urlLinkConfirmEmail = config.get("domainUrlClient") + "/confirm-email/" + data._id + "/" + data.emailToken
    let linkConfirmEmail = this.mailService.getLinkAction(urlLinkConfirmEmail)
    let btnConfirmEmail = this.mailService.getBtnAction(urlLinkConfirmEmail, "Activer mon compte")
    
    let replaceVal = [
      { key: "userName",  val: data.name },
      { key: "linkConfirmEmail", val: linkConfirmEmail },
      { key: "btnConfirmEmail", val: btnConfirmEmail },
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
const config = require('config')
const { User } = require('../../models/User')
const { Email } = require('../../models/Email')


const MailCoreService = require('../../services/mailcore')

module.exports = class MailResetPassword {

  constructor() {
    this.mailService = new MailCoreService()
  }

  async getEmailData(userId, dataSec){
    let data = await User.findOne({ _id: userId })

    let email = await Email.findOne({ key: "resetPassword" })
    if(email == null) return { error : true, msg : "no email found in bdd" }

    let urlLinkResetPwd = config.get("domainUrlClient") + "/reset-password/" + userId + "/" + data.pwdToken
    let linkResetPwd = this.mailService.getLinkAction(urlLinkResetPwd)
    let btnResetPwd = this.mailService.getBtnAction(urlLinkResetPwd, "Réinitialiser mon mot de passe")
    
    let replaceVal = [
      { key: "userName",  val: data.name },
      { key: "linkResetPwd", val: linkResetPwd },
      { key: "btnResetPwd", val: btnResetPwd },
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
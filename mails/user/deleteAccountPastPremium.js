const config = require('config')
const { User } = require('../../models/User')
const { Email } = require('../../models/Email')


const MailCoreService = require('../../services/mailcore')

module.exports = class MailDeleteAccountPastPremium {

  constructor() {
    this.mailService = new MailCoreService()
  }

  async getEmailData(userId, dataSec){
    let data = await User.findOne({ _id: userId })

    let email = await Email.findOne({ key: "deleteAccountPastPremium" })
    if(email == null) return { error : true, msg : "no email found in bdd" }
     
    let replaceVal = [
      { key: "userName",  val: data.name }
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
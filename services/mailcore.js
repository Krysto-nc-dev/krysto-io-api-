const config = require('config')
const Postal = require('@atech/postal');
const nodemailer = require("nodemailer");

//const fs = require("fs")
//const { MailCore } = require('../models/MailCore')


module.exports = class MailCoreService {

  constructor() {
    //this.postalClient = new Postal.Client(config.get("mailserver.domain"), config.get("mailserver.apikey"))
    this.replyTo = config.get("email.replyTo")
  }

  async sendMailTest(resaId){
    console.log("MailService/sendMailTest()", config.get("mailserver.domain"), config.get("mailserver.apikey"))
    
    // Create a new message
    var message = new Postal.SendMessage(this.postalClient);
    console.log("MailService/sendMailTest() message ready")

    // Add some recipients
    message.to('tristan.goguet@protonmail.com');
    //message.cc('mike@example.com');
    //message.bcc('secret@awesomeapp.com');

    // Specify who the message should be from - this must be from a verified domain
    // on your mail server
    message.from('tom@pixeliz-avatar.com');
    message.replyTo('tristan.goguet@protonmail.com');

    const MailConfirmOpen = require('../mails/reservation/confirmOpen.js')
    let mailConfirmOpen = new MailConfirmOpen()
    let subject = mailConfirmOpen.getSubject()
    let html = await mailConfirmOpen.getHtml(resaId)

    // Set the subject
    message.subject(subject)
    message.htmlBody(html)

    console.log("MailService/sendMailTest() Before send")

    if(config.get("email.mode") == "dev") return html

    // Send the message and get the result
    message.send()
      .then(function (result) {
        var recipients = result.recipients();
        console.log('MailService/sendMailTest() recipients', recipients);    // Logs the message ID
        // Loop through each of the recipients to get the message ID
        for (var email in recipients) {
          var msg = recipients[email];
          console.log(msg.id());    // Logs the message ID
          console.log(msg.token()); // Logs the message's token
        }
      }).catch(function (error) {
        // Do something with the error
        console.log("catch error", error.code);
        console.log("catch error", error.message);
      });
  }

  async sendMailContact(msgContact){
    
    let msg = this.nl2br(msgContact.message)
    let emailParams = { to: config.get("email.contactTo"),
                        from: config.get("email.from.contact"),
                        replyTo: msgContact.email,
                        subject: "Contact",
                        html: "Message de <b>" + msgContact.name + "</b>, " + msgContact.email + " : <br><br>" + msg
                      }
    let mailRes = await this.sendMail(emailParams)
    
    //console.log("MailService/sendMailContact() mailRes:", mailRes)
    return  { error: false, mailRes: mailRes, emailParams: emailParams }
  }

  async sendMailByTemplate(data, type, templateName, dataSec){
    //console.log("sendMailByTemplate", type, data._id, templateName)
    
    if(!data.enableMailNotif) {
      //console.log("mail notif disabled for this user")
      return { error: false, msg: "mail notif disabled for this user" }
    }

    const MailTemplate = require('../mails/' + type + '/' + templateName + '.js')
    let mail = new MailTemplate()
    //récupère les valeurs du mail { to, from, subject, html }
    let emailParams = await mail.getEmailData(data._id, dataSec)    
    //envoi le mail avec les valeurs spécifiées (et récupère les erreurs)
    let mailRes = await this.sendMail(emailParams)
    
    return  { error: false, mailRes: mailRes, emailParams: emailParams }
  }

  async sendMail(emailParams){
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      host: config.get("mailserver.host"),
      port: config.get("mailserver.port"),
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.get("mailserver.user"), // generated ethereal user
        pass: config.get("mailserver.pass"), // generated ethereal password
      },
    });

    let replyTo = emailParams.replyTo ? emailParams.replyTo : this.replyTo
    
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: emailParams.from,       // sender address
      to: emailParams.to,           // list of receivers
      subject: emailParams.subject, // subject line
      replyTo: replyTo,             // replyTo
      html: emailParams.html,       // html body
    });

    console.log("info mail sent", info)
    return { error : false }
  }

  //send email using Postal webserver
  async sendMailOld(emailParams){ 
    // Create a new message
    var message = new Postal.SendMessage(this.postalClient);
    
    message.from(emailParams.from)
    message.replyTo(emailParams.replyTo ? emailParams.replyTo : this.replyTo)

    message.to(emailParams.to)
    message.subject(emailParams.subject)
    message.htmlBody(emailParams.html);

    //en mode test, on n'envoie pas le mail, 
    //on renvoie seulement le html pour pouvoir l'afficher en front
    if(config.get("email.mode") != "dev") {
      // Send the message and get the result
      message.send()
             .then(function (result) {
                //var recipients = result.recipients()
                /* Loop through each of the recipients to get the message ID
                  for (var email in recipients) {
                    var msg = recipients[email];
                    console.log(msg.id());    // Logs the message ID
                    console.log(msg.token()); // Logs the message's token
                  }
                */
             }).catch(function (error) {
                console.log("catch error", error.code);
                console.log("catch error", error.message);
             });
    }
    //TODO: ajouter un try catch pour capter les erreurs d'envoie de mail
    return { error : false }
  }

  async getHtmlBody(html, replaceVal){
    //replace les valeurs 
    replaceVal.forEach((attr)=>{
      html = html.replace("["+ attr.key +"]", attr.val)
    })
    //construction du header avec img pour le logo et le nom du site
    let imgLogo = this.getImgLogo()
    let imgSiteName = this.getImgSiteName()

    let header = "<div class='text-align:center; border-bottom: 1px solid #dfdfdf;'>" 
               //+    imgLogo 
               //+    "<br>" 
               +    imgSiteName 
               + "</div>"

    let signature = config.get("email.signature")
                  + "<br>"
                  + this.getLinkSignature()

    html = this.nl2br(html)
    html = header
         + "<br>" 
         + html
         + "<br><br>"
         + signature
    
    //console.log("getHtmlBody:", html)
    return html
  }

  getImgLogo(){ return "<img src='"+config.get("domainUrlApiProd")+ "/emails/logo.png'     width='50'/>" }
  getImgSiteName(){ return "<img src='"+config.get("domainUrlApiProd")+ "/emails/siteName.png' width='200'/>" }
  getClientMail(data){ return config.get("email.mode") == "prod" ? data.email : config.get("email.devTo") }
  
  getBtnAction(url, text){
    return "<a style='padding:8px; border-radius: 4px; color: white !important; background-color: #ff8a34; text-decoration:none;'"+
           "   href='"+url+"' target='_blank'>"+text+"</a>"
  }
  getLinkAction(url){
    return "<a href='"+url+"' target='_blank'>"+url+"</a>"
  }
  //signature affichée en bas de tous les mails
  getLinkSignature(){
    return "<a href='"+config.get("domainUrlClient")+"' target='_blank'>"+config.get("email.signature")+"</a>"
  }
  
  nl2br(str, is_xhtml){
    var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br ' + '/>' : '<br>'
    let newStr = (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2')
    return newStr
  }
  
  /**
    // Add some recipients
    //message.cc('mike@example.com');
    //message.bcc('secret@awesomeapp.com');

    // Add any custom headers
    //message.header('X-PHP-Test', 'value');
    // Attach any files
    //message.attach('textmessage.txt', 'text/plain', 'Hello world!');
  */

}
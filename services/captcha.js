
const config = require('config')
const { Captcha, validate } = require('../models/Captcha')
var randomize = require('randomatic')
var crypto = require('crypto')

module.exports = class CaptchaService {

  constructor() {}

  async newCaptchaSession(){
    let nbCubes = parseInt(Math.random() * 7) + 2
    let nbCubesRotate = parseInt(Math.random() * nbCubes) + 1
    let sessionid = randomize('Aa0', 32)

    let session = { 
      sessionid: sessionid, 
      nbCubes: nbCubes, 
      nbCubesRotate: nbCubesRotate,
      created: new Date()
    } 

    let captcha = new Captcha(session)
    await captcha.save()
    
    var text = JSON.stringify(session)
    
    // On définit notre algorithme de cryptage, doit être le même pour le décryptage
    var algorithm = config.get("captcha.algorithm")
    // // clé de chiffrement, doit être la même pour le décryptage
    var cryptokey = config.get("captcha.cryptokey")
    // Defining iv
    const iv = Buffer.alloc(16, 0)

    // // On crypte notre texte
    var cipher = crypto.createCipheriv(algorithm, cryptokey, iv)
    var sessionCrypted = cipher.update(text,'utf8','hex')
    sessionCrypted += cipher.final('hex')
    
    return { error: false,
             session: sessionCrypted
           }
  }

  async checkCaptchaAnswer(answer, sessionid){

    let captcha = await Captcha.findOne({ sessionid: sessionid })
    //si le captcha n'est pas trouvé
    if(captcha == null) return { success: false, captchaFound: false }

    let result = { success: (captcha.nbCubesRotate == answer), captchaFound: true }
    await captcha.remove()
    
    return result
  }

}

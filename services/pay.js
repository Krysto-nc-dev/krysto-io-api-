const config = require("config")
var axios = require("axios")

module.exports = class PayService {

  constructor() {
    this.stripe = require('stripe')(config.get("stripe.private_key"))
    this.domaine = config.get("domainUrlClient")
  }


  async createCheckOutSession(priceId, user, mode){
    //console.log("*** in createCheckOutSession", priceId, user.name)
    try{
      const session = await this.stripe.checkout.sessions.create({
        line_items: [{
            price: priceId,
            quantity: 1,
          }],
        mode: mode,
        success_url: `${this.domaine}/payment/thanks`,
        cancel_url: `${this.domaine}/market`,
      })
      //console.log("*** Success in createCheckOutSession", session.id)

      user.paymentSessionId = session.id
      user.save()

      return { error: false, sessionUrl: session.url }
    }
    catch(e){
      console.log("*** Error in createCheckOutSession", priceId)
      console.log(e)
      return { error: true }
    }
  }
}
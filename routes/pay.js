var express = require("express")
var router = express.Router()
const config = require("config")

const PayService = require('../services/pay')
const UserService = require('../services/user')

const { User } = require('../models/User')

const auth = require("../middleware/auth")


const stripe = require('stripe')(config.get("stripe.private_key"))

//const endpointSecret = "whsec_409289ca4cdda6c28af75fcbb7ec403fe935b2357c35e95be80285ec03e7946c";


router.post('/subscription', async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/pay/subscription/", req.body.stripePriceId)

  let user = await User.findOne({ _id: req.body.userId }).populate("plan")
  if(user == null || user.planPaid) return res.send({error : true})

  let mode = user.plan.isRecurent ? 'subscription' : 'payment'

  let payService = new PayService()
  let result = await payService.createCheckOutSession(req.body.stripePriceId, user, mode)
  
  return res.send({ error : result.error, sessionUrl : result.sessionUrl })
})



router.post('/webhooks', async (req, res) => {
  //console.log("--------------------------------")
  //console.log("/pay/webhooks/") //, req.headers["stripe-signature"])

  let data;
  let eventType;
  // Check if webhook signing is configured.
  const webhookSecret = config.get("stripe.webhookSecret") 
  //"whsec_409289ca4cdda6c28af75fcbb7ec403fe935b2357c35e95be80285ec03e7946c"

  if (webhookSecret) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody, signature, webhookSecret
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`, err);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  let user = null

  switch (eventType) {
      case 'checkout.session.completed':
        // Payment is successful and the subscription is created.
        // You should provision the subscription and save the customer ID to your database.
        console.log('/pay/webhooks/ checkout.session.completed', req.body.data.object.id)
        
        user = await User.findOne({ paymentSessionId: req.body.data.object.id }).populate("plan")
        if(user != null){
          user.planPaid = true
          user.paymentCustomerId = req.body.data.object.customer
          user.paymentSubscriptionId = req.body.data.object.subscription
          user.paymentLastDate = new Date()

          let now = new Date()
          let dateExpire = new Date()

          if(user.plan.type == 'day') dateExpire.setDate(now.getDate() + 2)
          if(user.plan.type == 'month') dateExpire.setDate(now.getDate() + 32)
          if(user.plan.type == 'year') dateExpire.setDate(now.getDate() + 366)

          user.paymentExpireDate = dateExpire

          await user.save()

          let userService = new UserService()
          await userService.confirmPayment(user)
        }

        break;
      case 'invoice.paid':
        // Continue to provision the subscription as payments continue to be made.
        // Store the status in your database and check when a user accesses your service.
        // This approach helps you avoid hitting rate limits.
        console.log('/pay/webhooks/ invoice.paid', req.body.data.object.customer)

        user = await User.findOne({ paymentCustomerId: req.body.data.object.customer })
        if(user != null){
          user.planPaid = true
          user.paymentLastDate = new Date()
          await user.save()
        }

        break;
      case 'invoice.payment_failed':
        // The payment failed or the customer does not have a valid payment method.
        // The subscription becomes past_due. Notify your customer and send them to the
        // customer portal to update their payment information.
        console.log('/pay/webhooks/ invoice.payment_failed', req.body.data.object.customer)
        user = await User.findOne({ paymentCustomerId: req.body.data.object.customer })
        if(user != null){
          user.planPaid = false
          await user.save()
        }

        break;
      case 'payment_method.attached':
        console.log('/pay/webhooks/ payment_method.attached : ', req.body.data.object.card.fingerprint)

        user = await User.findOne({ paymentCustomerId: req.body.data.object.customer })
        if(user != null){
          user.paymentCardFingerPrint = req.body.data.object.card.fingerprint
          await user.save()
        }

        break;

      case 'customer.subscription.deleted':
        console.log('/pay/webhooks/ customer.subscription.deleted : ', req.body.data.object.customer)

        user = await User.findOne({ paymentCustomerId: req.body.data.object.customer })
        if(user != null){
          user.planPaid = false
          await user.save()
        }
        break;
      default:
      // Unhandled event type
    }

  res.sendStatus(200);
})


router.post('/cancel-subscription', auth, async (req, res) => {
  console.log("--------------------------------")
  console.log("/pay/cancel-subscription/")

  try{
    let user = await User.findOne({ _id: req.user._id })
    if(user == null) return res.send({error : true, errorMsg: "ERROR_USER"})

    stripe.subscriptions.update(user.paymentSubscriptionId, {cancel_at_period_end: true})

    user.paymentSubscriptionCanceled = true
    await user.save()

    return res.send({error : false})
  }
  catch(e){
    return res.send({error : true, errorMsg: "ERROR" })
  }

  
})

module.exports = router;
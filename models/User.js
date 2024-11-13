var mongoose = require("mongoose")
const Joi = require('joi')
const bcrypt = require("bcrypt")
//const config = require('config')

var userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    accessToken: String,

    city: String,
    address: String,
    coordinates: Array,

    paymentSessionId: String,
    paymentCustomerId: String,
    paymentSubscriptionId: String,
    paymentCardFingerPrint: String,
    paymentSubscriptionCanceled: Boolean,
    paymentLastDate: Date,
    paymentExpireDate: Date,

    walletMain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletMain'
    },
    walletsDeposit: [{
      type: mongoose.Schema.Types.ObjectId,
      default: [],
      ref: 'WalletDeposit'
    }],

    walletsContact: { type: Array, default : [] },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan'
    },

    offers: [{ //annonces créées par le user
      type: mongoose.Schema.Types.ObjectId,
      default: [],
      ref: 'Offer'
    }],

    propositionsSent: [{
        type: mongoose.Schema.Types.ObjectId,
        default: [],
        ref: 'Proposition'
    }],

    pwdToken: String,

    emailToken: String,
    emailChecked: { type: Boolean, default : false },

    isDeleted:       { type: Boolean, default : false },
    isActive:        { type: Boolean, default : false },
    isLocked:        { type: Boolean, default : false },
    planPaid:        { type: Boolean, default : false },
    isAdmin:         { type: Boolean, default : false },
    enableMailNotif: { type: Boolean, default : true },

    lastMail: Date,
    created: Date,
    updated: Date,
})

var User = mongoose.model('User', userSchema)

function validateUser(user, entityId) {
  const schemaCreate = {
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().min(5).max(255).required().email(),
    password: Joi.string().min(8).max(255).required(),
    isAdmin: Joi.boolean(),
    isDeleted: Joi.boolean(),
    isLocked: Joi.boolean(),
    city: Joi.string().min(1).max(40),
    address: Joi.string().min(1).max(40),
    coordinates: Joi.array(),
    pwdToken: Joi.string(),
    enableMailNotif: Joi.boolean(),
    emailChecked: Joi.boolean(),
    emailToken: Joi.string(),
    planPaid: Joi.boolean(),
    planKey: Joi,
    plan: Joi,
    captcha: Joi,
    paymentSessionId: Joi,
    paymentCustomerId: Joi,
    paymentCardFingerPrint: Joi,
    paymentSubscriptionId: Joi,
  }
  const schemaEdit = {
    name: Joi.string().min(3).max(50),
    email: Joi.string().min(5).max(255).email(),
    password: Joi.string().min(8).max(255),
    isAdmin: Joi.boolean(),
    isDeleted: Joi.boolean(),
    isLocked: Joi.boolean(),
    city: Joi.string().min(1).max(40),
    address: Joi.string().min(1).max(40),
    pwdToken: Joi.string(),
    enableMailNotif: Joi.boolean(),
    emailChecked: Joi.boolean(),
    emailToken: Joi.string(),
    coordinates: Joi.array(),
    planPaid: Joi.boolean(),
    planKey: Joi,
    plan: Joi,
    captcha: Joi,
    paymentSessionId: Joi,
    paymentCustomerId: Joi,
    paymentCardFingerPrint: Joi,
    paymentSubscriptionId: Joi,
  }
  if(entityId == null) return Joi.validate(user, schemaCreate)
  else                 return Joi.validate(user, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
  console.log("afterCreateByAdmin", entity)
  encryptPassword(entity)
}

async function encryptPassword(entity) {
  if(entity.password == null) return
  const salt = await bcrypt.genSalt(10);
  let encPass = await bcrypt.hash(entity.password, salt)
  entity.password = encPass
  entity.save()
  return entity.password
}

exports.User = User
exports.Model = User
exports.validate = validateUser
exports.afterCreateByAdmin = afterCreateByAdmin
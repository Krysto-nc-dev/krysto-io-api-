var mongoose = require("mongoose")
const Joi = require('joi')
//const config = require('config')

var planSchema = new mongoose.Schema({

    key: String,
    name: String,
    description: String,
    longDescription: String,
    type: String,
    color: String,

    amount: { type : Number, default: 0 },
    position: { type : Number, default: 0 },
    stripeId: String,

    isActive: Boolean,
    isRecurent: Boolean,

    created: Date,
    updated: Date,
})

var Plan = mongoose.model('Plan', planSchema)

function validatePlan(plan, entityId) {
  const schemaCreate = {
    key: Joi.string().min(1).max(20).required(),
    name: Joi.string().min(1).max(20).required(),
    description: Joi.string().min(0).required(),
    longDescription: Joi.string().min(0).required(),
    type: Joi.string().min(1).max(20).required(),
    color: Joi.string().min(1).max(20).required(),
    stripeId: Joi.string().required(),
    amount: Joi.number().min(0),
    position: Joi.number().min(0),
    isActive: Joi.boolean(),
    isRecurent: Joi.boolean(),
    
  }
  const schemaEdit = {
    key: Joi.string().min(1).max(20).required(),
    name: Joi.string().min(1).max(20).required(),
    description: Joi.string().min(0).required(),
    longDescription: Joi.string().min(0).required(),
    color: Joi.string().min(1).max(20).required(),
    type: Joi.string().min(1).max(20).required(),
    stripeId: Joi.string().required(),
    position: Joi.number().min(0),
    amount: Joi.number().min(0),
    isActive: Joi.boolean(),
    isRecurent: Joi.boolean(),
    
  }
  if(entityId == null) return Joi.validate(plan, schemaCreate)
  else                 return Joi.validate(plan, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
  console.log("afterCreateByAdmin", entity)
  
}

exports.Plan = Plan
exports.Model = Plan
exports.validate = validatePlan
exports.afterCreateByAdmin = afterCreateByAdmin
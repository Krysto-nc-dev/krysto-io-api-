var mongoose = require("mongoose")
const Joi = require('joi')
const bcrypt = require("bcrypt")
//const config = require('config')

var instanceSchema = new mongoose.Schema({

    name: String,

    unityTotal: { type : Number, default: 0 },
    monyConvertValue: { type : Number, default: 0 },

    limitForFreePlan: { type : Number, default: 0 },

    nbUsers: { type : Number, default: 0 },

    isActive: Boolean,

    created: Date,
    updated: Date,
})

var Instance = mongoose.model('Instance', instanceSchema)

function validateInstance(instance, entityId) {
  const schemaCreate = {
    name: Joi.string().min(1).max(20).required(),
    unityTotal: Joi.number().min(0),
    monyConvertValue: Joi.number().min(0),
    limitForFreePlan: Joi.number().min(0),
    
  }
  const schemaEdit = {
    name: Joi.string().min(1).max(20).required(),
    unityTotal: Joi.number().min(0),
    monyConvertValue: Joi.number().min(0),
    limitForFreePlan: Joi.number().min(0),
    
  }
  if(entityId == null) return Joi.validate(instance, schemaCreate)
  else                 return Joi.validate(instance, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
  console.log("afterCreateByAdmin", entity)
  
}

exports.Instance = Instance
exports.Model = Instance
exports.validate = validateInstance
exports.afterCreateByAdmin = afterCreateByAdmin
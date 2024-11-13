var mongoose = require("mongoose")
const Joi = require('joi')

var emailSchema = new mongoose.Schema({
    key: String,
    message: String,
    subject: String,
    
    created: Date,
    updated: Date,
})


var Email = mongoose.model('Email', emailSchema)

function validate(email, entityId) {
    const schemaCreate = {
      key: Joi.string().min(1).max(50).required(),
      message: Joi.string().max(10000),
      subject: Joi.string().max(300)
    }
    const schemaEdit = {
      key: Joi.string().min(1).max(50).required(),
      message: Joi.string().max(10000),
      subject: Joi.string().max(300)
    }

    if(entityId == null) return Joi.validate(email, schemaCreate)
    else                 return Joi.validate(email, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){}

exports.Email = Email
exports.Model = Email
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
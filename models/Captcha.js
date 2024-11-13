var mongoose = require("mongoose")
const Joi = require('joi')

var captchaSchema = new mongoose.Schema({
    sessionid: String,
    nbCubes: Number,
    nbCubesRotate: Number,
    
    created: Date,
    updated: Date,
})


var Captcha = mongoose.model('Captcha', captchaSchema)

function validate(captcha, entityId) {
    const schemaCreate = {
      sessionid: Joi.string().min(1).max(32).required(),
      nbCubes: Joi.Number().required(),
      nbCubesRotate: Joi.Number().required(),
    }
    const schemaEdit = {
      sessionid: Joi.string().min(1).max(32).required(),
      nbCubes: Joi.Number().required(),
      nbCubesRotate: Joi.Number().required(),
    }

    if(entityId == null) return Joi.validate(captcha, schemaCreate)
    else                 return Joi.validate(captcha, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){}

exports.Captcha = Captcha
exports.Model = Captcha
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
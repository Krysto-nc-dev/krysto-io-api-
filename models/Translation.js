var mongoose = require("mongoose")
const Joi = require('joi')

var translationSchema = new mongoose.Schema({
    entityId: String,
    entityType: String,
    attrName: String,
    lang: String,
    text: String,
    created: Date,
    updated: Date,
})


var Translation = mongoose.model('Translation', translationSchema)

function validate(translation, entityId) {
    const schemaCreate = {
        entityId: Joi.string().required(),
        entityType: Joi.string().required(),
        attrName: Joi.string().required(),
        lang: Joi.string().required(),
        text: Joi.string().required(),
    }
    const schemaEdit = {
        entityId: Joi.string().required(),
        entityType: Joi.string().required(),
        attrName: Joi.string().required(),
        lang: Joi.string().required(),
        text: Joi.string().required(),
    }

    if(entityId == null) return Joi.validate(translation, schemaCreate)
    else                 return Joi.validate(translation, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){}

exports.Translation = Translation
exports.Model = Translation
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
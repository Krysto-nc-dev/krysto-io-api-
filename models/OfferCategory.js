var mongoose = require("mongoose")
const Joi = require('joi')

var offerCategorySchema = new mongoose.Schema({
    name: String,
    created: Date,
    updated: Date,
})


var OfferCategory = mongoose.model('OfferCategory', offerCategorySchema)

function validate(offerCategory, entityId) {
    const schemaCreate = {
        name: Joi.string().min(1).max(40).required(),
    }
    const schemaEdit = {
        name: Joi.string().min(1).max(40).required(),
    }

    if(entityId == null) return Joi.validate(offerCategory, schemaCreate)
    else                 return Joi.validate(offerCategory, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.OfferCategory = OfferCategory
exports.Model = OfferCategory
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
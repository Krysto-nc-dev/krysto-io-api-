var mongoose = require("mongoose")
const Joi = require('joi')

var offerSchema = new mongoose.Schema({
    title: String,
    text: String,

    type: String, //OFFER OR DEMANDE
    status:  { type: String,  required: false, default : 'EDIT' }, //EDIT, OPEN, RESERVED, PAID OR CLOSED (OR LOCKED (by admin))
    
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OfferCategory'
    },

    amountMony: Number,
    uidWalletCreator: { type: String,  required: false, default : "" },

    gallery: { type: Array,  required: false, default : [] },

    propositions: [{
        type: mongoose.Schema.Types.ObjectId,
        default: [],
        ref: 'Proposition'
    }],

    reports: [{
        type: mongoose.Schema.Types.ObjectId,
        default: [],
        ref: 'User'
    }],

    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    city: String,
    address: String,
    coordinates: Array,

    fictif: { type: Boolean,  required: false, default : false },
    
    created: Date,
    updated: Date,

})


offerSchema.virtual('offer', {
    ref: 'OfferCategory',
    localField: '_id',
    foreignField: 'offer'
});

offerSchema.virtual('offer', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'offer'
});


var Offer = mongoose.model('Offer', offerSchema)

function validate(offer, entityId) {
    const schemaCreate = {
        title: Joi.string().min(1).max(50).required(),
        text: Joi.string().min(1).max(2000).required(),
        status: Joi.string().min(1).max(2000).required(),
        category: Joi.string(),
        uidWalletCreator: Joi,
        amountMony: Joi.required(),
        gallery: Joi,
        type: Joi.required(),
        creator: Joi.required(),
        city: Joi.string().min(1).max(40),
        address: Joi.string().min(1).max(40),
        coordinates: Joi.array(),
        fictif: Joi.boolean()
    }
    const schemaEdit = {
        title: Joi.string().min(1).max(50).required(),
        text: Joi.string().min(1).max(2000).required(),
        status: Joi.string().min(1).max(2000).required(),
        category: Joi.string(),
        uidWalletCreator: Joi,
        amountMony: Joi.required(),
        gallery: Joi,
        type: Joi.required(),
        creator: Joi.required(),
        city: Joi.string().min(1).max(40),
        address: Joi.string().min(1).max(40),
        coordinates: Joi.array(),
        fictif: Joi.boolean()
    }

    if(entityId == null) return Joi.validate(offer, schemaCreate)
    else                 return Joi.validate(offer, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Offer = Offer
exports.Model = Offer
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
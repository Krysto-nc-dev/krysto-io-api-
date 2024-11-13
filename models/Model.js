var mongoose = require("mongoose")
const Joi = require('joi')

var modelSchema = new mongoose.Schema({

    name: String,
    description: String,
    country: String,
    sexe: String,
    image:  { type: String, required: false, default : "" },
    imageBanner: { type: String, required: false, default : "" },
    gallery: { type: Array,  required: false, default : [] },

    public:     { type: Boolean, default: true },
    age:        { type: Number, default: 18 },
    ageRange:   { type: Array, default: [30, 50] },

    created: Date,
    updated: Date,

})

var Model = mongoose.model('Model', modelSchema)

function validate(model, entityId) {
    const schemaCreate = {
        name: Joi.string().min(3).max(50).required(),
        description: Joi.string().min(0).max(500),
        country: Joi.string().min(3).max(50),
        sexe: Joi.string(),
        public: Joi.boolean(),
        city: Joi.string(),
        cities: Joi.array().min(1),
        age: Joi.number().min(1),
        ageRange: Joi.array().min(1),
        eventType: Joi.string(),
        image: Joi,
        imageBanner: Joi,
        gallery: Joi.array()
    }
    const schemaEdit = {
        name: Joi.string().min(3).max(50).required(),
        description: Joi.string().min(0).max(500),
        country: Joi.string().min(3).max(50),
        sexe: Joi.string(),
        public: Joi.boolean(),
        city: Joi.string(),
        cities: Joi.array(),
        age: Joi.number().min(1),
        ageRange: Joi.array().min(1),
        eventType: Joi.string(),
        image: Joi,
        imageBanner: Joi,
        gallery: Joi.array()
    }

    if(entityId == null) return Joi.validate(model, schemaCreate)
    else                 return Joi.validate(model, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){}

exports.Model = Model
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin

//TODO : ajouter la traduction des messages d'erreur
//https://www.npmjs.com/package/joi-i18n

var mongoose = require("mongoose")
const Joi = require('joi')

var negoSchema = new mongoose.Schema({
    
    amount: Number,
    
    msgTxt: String,
    answerTxt: String,

    status:  { type: String, default : 'OPEN' }, //OPEN, ACCEPTED OR REFUSED
    
    
    proposition: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposition'
    },
    
    created: Date,
    updated: Date,
})


// negoSchema.virtual('nego', {
//     ref: 'NegoCategory',
//     localField: '_id',
//     foreignField: 'nego'
// });


var Nego = mongoose.model('Nego', negoSchema)

function validate(nego, entityId) {
    const schemaCreate = {
      amount: Joi.number().required(),
      msgTxt: Joi.string().required(),
      accepted: Joi.boolean(),
      proposition: Joi.required(),
    }
    const schemaEdit = {
      amount: Joi.number().required(),
      msgTxt: Joi.string().required(),
      accepted: Joi.boolean(),
      proposition: Joi.required(),
    }

    if(entityId == null) return Joi.validate(nego, schemaCreate)
    else                 return Joi.validate(nego, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Nego = Nego
exports.Model = Nego
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
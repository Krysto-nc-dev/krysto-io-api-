var mongoose = require("mongoose")
const Joi = require('joi')

var propositionSchema = new mongoose.Schema({
    
    offer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    },
    
    negos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nego'
    }],

    userCaller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    created: Date,
    updated: Date,

})


// propositionSchema.virtual('proposition', {
//     ref: 'PropositionCategory',
//     localField: '_id',
//     foreignField: 'proposition'
// });


var Proposition = mongoose.model('Proposition', propositionSchema)

function validate(proposition, entityId) {
    const schemaCreate = {
      status: Joi.string().required(),
      offer: Joi.required(),
      negos: Joi.array(),
      userCaller: Joi.required(),
    }
    const schemaEdit = {
      status: Joi.string().required(),
      offer: Joi.required(),
      negos: Joi.array(),
      userCaller: Joi.required(),
    }

    if(entityId == null) return Joi.validate(proposition, schemaCreate)
    else                 return Joi.validate(proposition, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Proposition = Proposition
exports.Model = Proposition
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
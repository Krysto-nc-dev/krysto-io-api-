var mongoose = require("mongoose")
const Joi = require('joi')

var reportSchema = new mongoose.Schema({
    offer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    },
    reporters: Array,

    status: String,

    created: Date,
    updated: Date,
})


var Report = mongoose.model('Report', reportSchema)

function validate(report, entityId) {
    const schemaCreate = {
      offer: Joi,
      status: Joi,
    }
    const schemaEdit = {
      offer: Joi,
      status: Joi,
    }

    if(entityId == null) return Joi.validate(report, schemaCreate)
    else                 return Joi.validate(report, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Report = Report
exports.Model = Report
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
var mongoose = require("mongoose")
const Joi = require('joi')

var questionSchema = new mongoose.Schema({
    title: String,
    text: String,
    created: Date,
    updated: Date,
})


var Question = mongoose.model('Question', questionSchema)

function validate(question, entityId) {
    const schemaCreate = {
      title: Joi.string().min(1).max(200).required(),
      text: Joi.string().min(1).max(5000).required(),
    }
    const schemaEdit = {
      title: Joi.string().min(1).max(200).required(),
      text: Joi.string().min(1).max(5000).required(),
    }

    if(entityId == null) return Joi.validate(question, schemaCreate)
    else                 return Joi.validate(question, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Question = Question
exports.Model = Question
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
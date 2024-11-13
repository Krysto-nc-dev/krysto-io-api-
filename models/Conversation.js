var mongoose = require("mongoose")
const Joi = require('joi')

var conversationSchema = new mongoose.Schema({
    
    user1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    user2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    },

    messages: { type: Array, default : [] },
    
    dateLastRead: { type: Array, default : [] },

    created: Date,
    updated: Date,
})


var Conversation = mongoose.model('Conversation', conversationSchema)

function validate(conversation, entityId) {
    const schemaCreate = {
      
    }
    const schemaEdit = {
      
    }

    if(entityId == null) return Joi.validate(conversation, schemaCreate)
    else                 return Joi.validate(conversation, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.Conversation = Conversation
exports.Model = Conversation
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
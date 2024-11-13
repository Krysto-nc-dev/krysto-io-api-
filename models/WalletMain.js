var mongoose = require("mongoose")
const Joi = require('joi')

var walletMainSchema = new mongoose.Schema({
    uid: String,
    name: String,

    type: { type: String, default: "MAIN" },

    amountMony: { type: Number, default: 0 },
    amountUnity: { type: Number, default: 0 },
    transactions: { type: Array, default : [] },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    created: Date,
    updated: Date,

})


// walletMainSchema.virtual('walletmain', {
//     ref: 'User',
//     localField: '_id',
//     foreignField: 'walletmain'
// });


var WalletMain = mongoose.model('WalletMain', walletMainSchema)

function validate(walletMain, entityId) {
    const schemaCreate = {
        uid: Joi.string().min(5).max(5).required(),
        name: Joi.string().min(0).max(30).required(),
        owner: Joi.required()
    }
    const schemaEdit = {
        uid: Joi.string().min(5).max(5).required(),
        type: Joi.required(),
        owner: Joi.required()
    }

    if(entityId == null) return Joi.validate(walletMain, schemaCreate)
    else                 return Joi.validate(walletMain, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.WalletMain = WalletMain
exports.Model = WalletMain
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
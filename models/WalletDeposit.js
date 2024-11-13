var mongoose = require("mongoose")
const Joi = require('joi')

var walletDepositSchema = new mongoose.Schema({
    uid: String,
    name: String,

    type: { type: String, default: "DEPOSIT" },

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


// walletDepositSchema.virtual('walletdeposit', {
//     ref: 'User',
//     localField: '_id',
//     foreignField: 'walletdeposit'
// });


var WalletDeposit = mongoose.model('WalletDeposit', walletDepositSchema)

function validate(walletDeposit, entityId) {
    const schemaCreate = {
        uid: Joi.string().min(5).max(5).required(),
        name: Joi.string().min(0).max(30).required(),
        owner: Joi.required()
    }
    const schemaEdit = {
        uid: Joi.string().min(5).max(5).required(),
        name: Joi.string().min(0).max(30).required(),
        owner: Joi.required()
    }

    if(entityId == null) return Joi.validate(walletDeposit, schemaCreate)
    else                 return Joi.validate(walletDeposit, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.WalletDeposit = WalletDeposit
exports.Model = WalletDeposit
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
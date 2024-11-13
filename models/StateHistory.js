var mongoose = require('mongoose');

var stateHistorySchema = new mongoose.Schema({
    date: Date,
    nbUsers: Number,
    nbWalletMain: Number,
    nbWalletDeposit: Number,
    nbOffers: Number,
    nbReports: Number,
    amountTotalUnity: Number,
    amountTotalMony: Number,
    monyConvertValue: Number
});

function validate(report, entityId) {
    const schemaCreate = {
        
    }
    const schemaEdit = {
        
    }

    if(entityId == null) return Joi.validate(report, schemaCreate)
    else                 return Joi.validate(report, schemaEdit)
}

var StateHistory = mongoose.model('stateHistory', stateHistorySchema);

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.StateHistory = StateHistory
exports.Model = StateHistory
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
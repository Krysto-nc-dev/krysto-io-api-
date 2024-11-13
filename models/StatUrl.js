var mongoose = require('mongoose');

var statUrlSchema = new mongoose.Schema({
    date: Date,
    lastDate: Date,
    url: String,
    count: Number,
    inx: Number, //to sort query
    clientDomaineName: String //krup.nc
});

var StatUrl = mongoose.model('statUrl', statUrlSchema);


function validate(report, entityId) {
    const schemaCreate = {
        date: Joi,
        lastDate: Joi,
        url: Joi,
        count: Joi,
        inx: Joi,
        clientDomaineName: Joi
    }
    const schemaEdit = {
        date: Joi,
        lastDate: Joi,
        url: Joi,
        count: Joi,
        inx: Joi,
        clientDomaineName: Joi
    }

    if(entityId == null) return Joi.validate(report, schemaCreate)
    else                 return Joi.validate(report, schemaEdit)
}

//executed by admin controller after fst creation of an entity
async function afterCreateByAdmin(entity){
}

exports.StatUrl = StatUrl
exports.Model = StatUrl
exports.validate = validate
exports.afterCreateByAdmin = afterCreateByAdmin
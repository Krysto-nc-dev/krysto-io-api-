var express = require("express")
var router = express.Router()

const auth = require("../middleware/auth-admin");
const config = require('config')
var axios = require("axios")
const fs = require('fs')

const AdminService = require('../services/admin')

//accessible for all : no middlware
router.get('/:entityType', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/import", req.params.entityType)

  let entityType = req.params.entityType
  if(entityType == null) 
    return res.send({ error: true, 
                      msg: "entityType is null : Merci de préciser le type de données que vous souhaitez importer" })

  var schema = JSON.parse(fs.readFileSync("./import/" + entityType + ".json", 'utf8'));
  
  let hostUrl = 'http://127.0.0.1:8000/export/'
  let resExport = await axios.get(hostUrl+schema.tableName)
  //console.log("resX", resExport.data)
  // return res.send(resExport.data)
  return res.send({ error: resExport.data.error, 
                    datas: resExport.data.datas,
                    schema: schema,
                    hostUrl: hostUrl+schema.tableName
                  })
})




router.post('/save-entity', auth,  async (req, res) => {
  console.log("--------------------------------")
  console.log("/import/save-entity", req.body.entityType, req.body.entityData.idi)

  let entityType = req.body.entityType
  let entityData = req.body.entityData

  let adminService = new AdminService()
  const { Model, validate, afterCreateByAdmin } = adminService.requireModel(entityType)

  const { error } = validate(req.body.entityData)
  if (error) return res.send({ error: true, validateErrors: error })

  //si un id est passé en paramètre : récupère l'obj dans la bdd
  //sinon crée un nouvel obj
  let entity = (entityData["idi"] != null) 
             ? await Model.findOne({ "idi" : entityData["idi"] }) 
             : new Model() 
  
  //si idi exist, mais que la donnée n'a pas été trouvée en bdd
  if(entity == null) entity = new Model()
  
  //récupère la description des différents champs du formulaire correspondant à entityType
  let formJson = await adminService.getFormJson(req.body.entityType)
  //initialise la valeur de chaque attribut
  for(attrName in entityData){
    entity[attrName] = entityData[attrName]
  }

  //récupération des ID locaux, pour faire les jointures entre les tables (références entre obj)
  await Promise.all(formJson.map(async (input) => {
    //type ENTITY : attribut de jointure (multiple = true/false)
    if(input.type == "ENTITY"){
      //si jointure sur 1 seul élément && que l'attribut est présent dans la donnée envoyée
      if(input.multiple == false && entityData[input.name] != null){
        entity[input.name] = await adminService.getRefId(entityData[input.name], input.entityType)
      }//sinon : jointure sur plusieurs éléments && array/object présent
      else if(input.multiple == true && typeof entityData[input.name] == "object"){
        let refs = []
        //pour chaque référence avec l'id initial
        await Promise.all(entityData[input.name].map(async (refId) => {
          //récupère l'id équivalent en bdd locale
          let id = await adminService.getRefId(refId, input.entityType)
          if(id != null) refs.push(id)
        }))
        entity[input.name] = refs
      }
    }
  }))

  //enregistre la date de création
  entity.created = new Date()
  //enregistre toujours la date de modification
  entity.updated = new Date()

  try{
    //enregistre la donnée
    //console.log("entity finale", entity)
    await entity.save()
  }catch(e){
    console.log("entity finale with error", entity)
    const { error } = validate(entity)
    if (error) return res.send({ error: true, validateErrors: error, entity: entity })
  }

  await afterCreateByAdmin(entity)

  //console.log("/import/save-entity success")
  res.send({ error: false, validateErrors: [], entityId: entity.id })
})


module.exports = router;
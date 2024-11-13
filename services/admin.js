const moment = require('moment')

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const config = require('config')

const { Translation } = require('../models/Translation')
const TranslationService = require('../services/translation')
const UserService = require('../services/user')

const { User } = require('../models/User')
const { Plan } = require('../models/Plan')

const translationService = new TranslationService()

module.exports = class AdminService {

  constructor() {}

  requireModel(entityType){
    //remplace la premiere lettre par une majuscule
    let entityName = entityType.replace(/^\w/, (c) => c.toUpperCase());
    return require('../models/' + entityName)
  }

  async getEntityTypesAvailables(){
    return [ "model", "user", "walletMain", "walletDeposit", 
              "instance", "offer", "offerCategory", "report", 
              "question", "plan", "email" ]
  }

  async getFormJson(entityType){
    var fs = require('fs');
    var formJson = JSON.parse(fs.readFileSync("./forms/" + entityType + ".json", 'utf8'));
    return formJson
  }

  async getFormEntity(entityType, entityId){
      const { Model } = this.requireModel(entityType)
      let entity = await Model.findOne({ '_id': entityId })
      return entity
  }

  async getFormEntities(entityType, query, lang){
      const { Model } = this.requireModel(entityType)
      let entities = await Model.find(query).sort({ "created" : -1 }).limit(100)
      //traduction des entitées trouvées
      await Promise.all(entities.map(async (entity, i) => {
        entities[i] = await translationService.translateEntity(entity, entityType, lang)
      }))
      return entities
  }

  async queryEntity(entityType, query, limit, lang, sort){
    //juste par sécurité, pour éviter de charger trop de données d'un coup
    //TODO : définir cette limite dans le fichier de config
    if(limit == null || limit > 5000) limit = 5000
    limit = parseInt(limit)

    let entityName = entityType.replace(/^\w/, (c) => c.toUpperCase())
  
    const { Model } = this.requireModel(entityName)
  
    let formJson = await this.getFormJson(entityType)
    
    //récupère la liste des attributs sur lesquels il faut faire un populate
    let attrPop = []
    await Promise.all(formJson.map(async (attr) => {
      if(attr.type == "ENTITY"){
        let eName = attr.entityType.replace(/^\w/, (c) => c.toUpperCase())
        require('../models/' + eName)
        attrPop.push(attr.name)
      }
    }))

    sort = sort == null ? { "updated" : -1 } : sort

    try{
      //ne jamais renvoyer les token, ni les mot de passe
      let select = ["-accessToken", "-pwdToken", "-emailToken", "-password", 
                    "-paymentSessionId", "-paymentCustomerId", "-paymentSubscriptionId", "-paymentCardFingerPrint"] 

      let entities = await Model.find(query).select(select)
                                .limit(limit).sort(sort)
                                .populate(attrPop)

      if(lang == null) lang = translationService.getDefaultLang()
      //traduction de chaque entité
      await Promise.all(entities.map(async (entity, i) => {
        entities[i] = await translationService.translateEntity(entity, entityType, lang)
      }))

      return entities

    }catch(e){
      console.log("***************error in queryEntity", e)
    }
  }

  async deleteEntity(entityType, entityId){
    //console.log("deleteEntity", entityType, entityId)
    try{
      let entityName = entityType.replace(/^\w/, (c) => c.toUpperCase()) 
      const { Model } = this.requireModel(entityName)

      let del = await Model.deleteOne({ _id: entityId })
      return (del.ok == 1 && del.n == 1)
    }catch(e){
      return false
    }
  }

  //fonction qui permet de remplacer des valeurs complexes par des strings, dans un obj
  //pour afficher les données dans un <v-data-table> par exemple
  async stringifyPopulated(entityType, entities){
    let cloneEntities = JSON.parse(JSON.stringify(entities))
    let formJson = await this.getFormJson(entityType)

    await Promise.all(cloneEntities.map(async (entity, e) => {
      //parcours tous les attributs du formulaire de type entityType
      await Promise.all(formJson.map(async (attr, a) => {
        //le cas des attributs populated : remplacer l'obj par un string
        if(attr.type == "ENTITY"){
          //plusieurs objets (array)
          if(attr.multiple && cloneEntities[e][attr.name] != null){
            let str = "" //concatenation des attributs "name" s'il y en a un
            cloneEntities[e][attr.name].forEach((item) =>{
              str += (str == "") ? item.name : ", " + item.name
            })
            cloneEntities[e][attr.name] = str
          }//objet unique
          else if(cloneEntities[e][attr.name] != null){
            //remplace l'obj par le string de l'attribut "name"
            if(cloneEntities[e][attr.name]["name"] != null)
              cloneEntities[e][attr.name] = cloneEntities[e][attr.name]["name"]
            else if(cloneEntities[e][attr.name]["title"] != null)
              cloneEntities[e][attr.name] = cloneEntities[e][attr.name]["title"]
          }
        }

        let val = cloneEntities[e][attr.name]
        //cas des intervales
        if(attr.type == "range-slider"){
          if(typeof val == "object" && val.length == 2)
            cloneEntities[e][attr.name] = val[0] + " / " + val[1]
        }
        //cas des boutons switch
        if(attr.type == "switch"){
          cloneEntities[e][attr.name] = val ? "true" : "false"
        }
        //cas des dates
        if(attr.type == "date"){
          let d = moment(val)
          cloneEntities[e][attr.name] = d.format('DD/MM/YYYY hh:mm')
        }

      }))
    }))
    return cloneEntities
  }

  async resizeImg(file){
    let ext = '.webp'
    const { filename: image } = file
    await sharp(file.path)
          .resize(600)
          .webp({ quality: 60 })
          .toFile(path.resolve(file.destination, '', image + ext))
    
    //console.log("resizeImg", file.path)
    fs.unlinkSync(file.path)

    return file.path.replace("public/", "") + ext
  }

  async cpToOriginalName(file, originalFile){
    if(fs.existsSync("public/" + file))
    fs.copyFileSync("public/" + file, "/var/www/PHP/repare/resizeimg/" + originalFile)
  }

  async deleteImgFile(file){
    if(fs.existsSync("public/" + file))
       fs.unlinkSync("public/" + file)
  }

  slugify(str){
    let separator = "-"
    let slug = str
        .toString()
        .normalize('NFD')                  // split an accented letter in the base letter and the acent
        .replace(/[\u0300-\u036f]/g, '')   // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 ]/g, '')        // remove all chars not letters, numbers and spaces (to be replaced)
        .replace(/\s+/g, separator)

    slug = slug.replace(new RegExp('-$'), '') //supprimer "-" s'il se trouve en dernière position du slug
    return slug
  }


  async getRefId(id, entityType){
    //recherche l'entité via son id (enregistré dans idi)
    const entities =  await this.queryEntity(entityType, {idi: id }, 1)
    if(entities.length == 0) {
      console.log(">>> getRefId not found:", entityType, "idi:", id)
      return null
    }
    return entities[0]._id
  }

  getSchemaHostAtt(schema, localAtt){
    let hostAtt = ""
    schema.schema.forEach((sch)=>{
      if(sch.local == localAtt) hostAtt = sch.host
    })
    return hostAtt
  }

  
}
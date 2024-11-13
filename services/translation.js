const config = require('config')
const { Translation } = require('../models/Translation')


module.exports = class TranslationService {

  constructor() {}

  isAttrTranslatable(formJson, attrName){
    let isTrans = false
    formJson.forEach((input)=>{
      if(input.name == attrName && input.translatable == true) isTrans = true
    })
    return isTrans
  }

  getDefaultLang(){
    return config.get("languages")[0]
  }

  saveTranslation(entityType, entityId, translations, formJson){
    const langs = config.get("languages")
    //pour chaque input du 
    formJson.forEach((input)=>{
      //si l'input est traduisible
      if(input.translatable){
        //si les données contiennent une valeur (array) pour ce nom d'attribut
        if(typeof translations[input.name] != "undefined"){
          //parcours les valeurs de chaque traduction
          langs.forEach(async (lang)=>{
            if(translations[input.name][lang] != null
            && translations[input.name][lang] != ""){
              const t = await Translation.findOne({ entityId: entityId, entityType: entityType, attrName: input.name, lang: lang })
              let trans = (t == null) ? new Translation() : t
              trans.entityId = entityId
              trans.entityType = entityType
              trans.attrName = input.name
              trans.lang = lang
              trans.text = translations[input.name][lang]
              trans.save()
            }
          })
        }
      }
    })
  }


  async translateEntity(entity, entityType, lang){
    //récupère la description json du formulaire demandé 
    let eType = entityType.replace(/^\w/, (c) => c.toLowerCase())
    let formJson = await this.getFormJson(eType)

    //si aucune langue donnée, on ne peut rien traduire
    if(lang == null) return entity
    if(lang == this.getDefaultLang()) return entity

    //pour chaque input du formulaire
    await Promise.all(formJson.map(async (attr) => {
      if(attr.translatable){
        //récupère les traductions
        let trans = await Translation.find({ 'entityId' : entity.id, 'entityType' : eType,
                                              'attrName': attr.name, 'lang' : lang
                                           })
        //remplace la valeur par défaut, par la traduction, pour cet attribut
        trans.forEach((t)=>{
          if(t.lang == lang) entity[attr.name] = t.text
        })
      }
      //pour les entity populated
      if(attr.type == "ENTITY"){
        //récupère le form json du type attr.entityType
        let fJson = await this.getFormJson(attr.entityType)
        let t = false //check si au moins un attribut de l'élément est traduisible
        let transAttrs = [] //liste des attributs à traduire chez l'element populated
        fJson.forEach((attr)=>{ 
          if(attr.name == 'name' && attr.translatable){ t = true 
            transAttrs.push(attr.name)
          }
        })
        if(t){ //pour chaque attribut à traduire
          await Promise.all(transAttrs.map(async (transAttr) => {
            if(entity[attr.name] != null){
              let trans = await Translation.findOne({ 'entityId' : entity[attr.name].id, 
                                                      'entityType' : attr.entityType,
                                                      'attrName': transAttr, 'lang' : lang })
              if(trans != null) //remplace la valeur par défaut par la traduction
                entity[attr.name][transAttr] = trans.text
            }
          }))
        }
      }
    }))
    return entity
  }


  async getTranslations(entity, entityType, formJson){
    let translations = {}
    let langs = config.get("languages")
    
    //pour chaque input/attribut du formulaire
    await Promise.all(formJson.map(async (attr, i) => {
      //si l'input peut être traduit
      if(attr.translatable){ 
        //rechercher toutes les traductions qui existent pour cet attribut
        let trans = await Translation.find({ 'entityId' : entity.id,
                                             'entityType' : entityType,
                                             'attrName': attr.name
                                           })
        //initialisation du tableau de traductions (vide par défaut)
        if(translations[attr.name] == null){ 
          translations[attr.name] = {}
          //pour chaque langue disponibles
          langs.forEach((l, i)=>{
            //sauf la langue principale
            if(i>0) translations[attr.name][l] = ""
          })
        }
        //si des traductions ont été trouvées en bdd : remplacer la valeur
        if(trans.length > 0) 
          trans.forEach((t)=>{ translations[attr.name][t.lang] = t.text })
      }
    }))
    return translations
  }
  

  async getFormJson(entityType){
    var fs = require('fs');
    var formJson = JSON.parse(fs.readFileSync("./forms/" + entityType + ".json", 'utf8'));
    return formJson
  }

}
const config = require('config')

const { Conversation } = require('../models/Conversation')

module.exports = class ConversationService {

  constructor() {}

  async updateMyDateLastRead(conv, myUserId){
    conv.dateLastRead.forEach((item, i) => {
      if(item.userId == myUserId)
        conv.dateLastRead[i].date = new Date()
    })
    return conv
  }


}









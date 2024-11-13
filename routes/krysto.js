var express = require("express")
var router = express.Router()
const bcrypt = require("bcrypt")

const { User, validate } = require('../models/User')

const UserService = require('../services/user')
const MailCoreService = require('../services/mailcore')

router.post('/register', async (req, res) => {

  console.log("/krysto/register")

  // validate the request body first
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message)

  //find an existing user by email
  let user = await User.findOne({ email: req.body.email })
  if (user != null && user.isDeleted) return res.json({ error: true, msg: "ACCOUNT_DELETED" })
  if (user != null) return res.json({ error: true, msg: "EMAIL_EXISTS" })

  //find an existing user by name
  user = await User.findOne({ name: req.body.name });
  if (user) return res.json({ error: true, msg: "USERNAME_EXISTS" })

  let userService = new UserService()
  user = await userService.createUser(req.body)

  if(user != null){
      const mailCoreService = new MailCoreService()
      let { mailRes, emailParams } = await mailCoreService.sendMailByTemplate(user, 'user', 'createAccount')
      return res.json({ error: false, user: user, mailRes, emailParams })
  }

  return res.json({ error: true, user: user })
});


module.exports = router;
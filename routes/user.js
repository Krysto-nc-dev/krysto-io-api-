var express = require("express")
var router = express.Router()
const bcrypt = require("bcrypt")

const auth = require("../middleware/auth");
const { User, validate } = require('../models/User')
const { Instance } = require('../models/Instance')

const ManagerService = require('../services/manager')
const MailCoreService = require('../services/mailcore')

router.get('/profil', auth,  async (req, res) => {
    const user = await User.findById(req.user._id).select("-password");
    if(user == null) res.json({ user: null })
    res.send(user);
})

router.post('/set-addresse', auth, async (req, res) => {
    //console.log("--------------------------------")
    //console.log("/user/set-addresse", req.body)
    
    const user = await User.findById(req.user._id)
    user.coordinates = [parseFloat(req.body.lat), parseFloat(req.body.lng)]
    user.city = req.body.city
    user.address = req.body.address
    user.save()

    res.send({ error: false, user: user });
})

router.post('/set-enable-mail-notif', auth, async (req, res) => {
    //console.log("--------------------------------")
    //console.log("/user/set-enable-mail-notif", req.body)
    
    const user = await User.findById(req.user._id)
    user.enableMailNotif = req.body.enable
    user.save()

    res.send({ error: false, user: user });
})

//modification du mot de passe du user connecté
router.post('/save-new-password', auth, async (req, res) => {
    //console.log("/user/save-new-password")
    let user = await User.findOne({ _id: req.user._id });
    if (!user) return res.json({ error: true, msg: "USERID_NOT_FOUND" })
  
    bcrypt.compare(req.body.password1, user.password, async function(err, bres) {
        if(bres == false){
            res.send({  error: true, 
                        errorMsg: 'PWD_FAILED' })
        }else{
            //cryptage du mot de passe
            const salt = await bcrypt.genSalt(10)
            user.password = await bcrypt.hash(req.body.password2, salt)
            await user.save()
            //vérifie si l'adresse email a été confirmée
            res.json({ error: false, user: user })
        }
    })
})

//modification de son email par le user connecté
router.post('/save-new-email', auth, async (req, res) => {
    //console.log("/user/save-new-email")
    let user = await User.findOne({ _id: req.user._id });
    if (!user) return res.json({ error: true, msg: "USERID_NOT_FOUND" })
  
    bcrypt.compare(req.body.password, user.password, async function(err, bres) {
        if(bres == false){
            res.send({  error: true, 
                        errorMsg: 'PWD_FAILED' })
        }else{
            user.email = req.body.email
            await user.save()
            //vérifie si l'adresse email a été confirmée
            res.json({ error: false, user: user })
        }
    })
})

//récupérer le token pour modifier son mot de passe
router.post('/get-token-password/', async (req, res) => {
    //console.log("/user/get-token-password")

    let user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ error: true, errorMsg: "USER_EMAIL_NOT_FOUND" })

    //génère un nouveau token quand le user demande à récupérer son mot de passe
    let token = Math.random().toString(36).substr(2)
    token += Math.random().toString(36).substr(2)
    //enregistre le token
    user.pwdToken = token
    await user.save()

    //envoi un mail au client, avec un lien contenant le token
    const mailCoreService = new MailCoreService()
    let { mailRes, emailParams } = await mailCoreService.sendMailByTemplate(user, 'user', 'resetPassword')
    return res.json({ error: false, mailRes, emailParams })

})

//enregistre un nouveau mot de passe, après procédure "mot de passe oublié"
router.post('/reset-password/', async (req, res) => {
    //console.log("/user/reset-password")
    let user = await User.findOne({ _id: req.body.userId });
    if (!user) return res.json({ error: true, errorMsg: "USERID_NOT_FOUND" })
  
    user = await User.findOne({ _id: req.body.userId, pwdToken: req.body.pwdToken });
    if (!user) return res.json({ error: true, errorMsg: "PWD_TOKEN_NOT_FOUND" })
  
    //cryptage du mot de passe
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(req.body.newPassword, salt)
    await user.save()
   
    res.json({ error: false, user: user })
})

router.post('/delete-account/', auth, async (req, res) => {
    console.log("/user/delete-account", req.user._id)

    let user = await User.findOne({ _id: req.user._id })
                            .populate("walletMain")
                            .populate("walletsDeposit")
                            .populate("plan")

    if (!user) return res.json({ error: true, msg: "USERID_NOT_FOUND" })
  
    bcrypt.compare(req.body.password, user.password, async function(err, bres) {
        if(bres == false){
            res.send({  error: true, 
                        errorMsg: 'PWD_FAILED' })
        }else{
            //récupère le total d'unité créé pour ce compte
            let managerService = new ManagerService()
            let resDelete = await managerService.deleteUser(user, true, true, false, true)
                        
            res.json(resDelete)
        }
    })
})
module.exports = router;



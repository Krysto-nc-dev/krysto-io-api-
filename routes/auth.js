var express = require("express")
var router = express.Router()
const bcrypt = require("bcrypt")
const { User, validate } = require('../models/User')
const { Instance } = require('../models/Instance')
const { Conversation } = require('../models/Conversation')

const config = require('config')
const jwt = require('jsonwebtoken')

const UserService = require('../services/user')
const MailCoreService = require('../services/mailcore')
const CaptchaService = require('../services/captcha')
const OtoService = require('../services/oto')

router.get('/whoami', async (req, res, next) => {
    if(req.header('x-auth-token')){
        let userTest = await User.findOne({ 'accessToken' : req.header('x-auth-token') })
                                 .populate("walletMain")
        
        if(userTest == null) return res.send({ error: true, msg: 'invalid token' })

        // ??? une requete de plus pour pas grand chose ? ???
        // mettre à jour le montant du compte principal, en mony, à partir de son nombre d'unité et du taux de conversion actuel
        // let otoService = new OtoService()
        // userText.walletMain.amountMony = 
        //     otoService.convertUnityMony(userText.walletMain.amountUnity, instance.monyConvertValue)

        let user = 
        await User.findOne({ 'accessToken' : req.header('x-auth-token') })
                    .populate("walletMain")
                    .populate("walletsDeposit")
                    .populate("plan")
                    .populate({
                    path: 'offers',
                    populate: [ { path: 'propositions', 
                                    populate: [{ path: 'negos'}, 
                                                { path: 'userCaller', 
                                                select: ['_id', 'name', 'city', 'coordinates']
                                            }] 
                                },  
                                { path: 'creator',
                                    select: ['_id', 'name', 'city', 'coordinates']
                                }
                                ]
                    })
                    .populate({
                    path: 'propositionsSent',
                    populate: [{ path: 'negos'}, 
                                { path: 'offer', 
                                    populate: { path: 'creator',
                                                select: ['_id', 'name', 'city', 'coordinates']
                                            }
                                }, 
                                { path: 'userCaller', 
                                    select: ['_id', 'name', 'city', 'coordinates']}] 
                    })
                             

        user.password = ""
        user.email = ""
        user.accessToken = ""

        let myConvs = await Conversation
                                .find({ '$or': [{ user1: user._id }, 
                                                { user2: user._id } ] })
                                .populate({ path: 'user1', select: ['_id', 'name', 'city', 'coordinates'] })
                                .populate({ path: 'user2', select: ['_id', 'name', 'city', 'coordinates'] })
                                .populate({ path: "offer", 
                                                populate: { path: 'creator',
                                                            select: ['_id', 'name', 'city', 'coordinates'] }
                                         })

        let i = await Instance.findOne({ name: 'main' })

        return res.send({ error: false, 
                          user: user, 
                          monyConvertValue: (i != null) ? i.monyConvertValue : 0,
                          conversations: myConvs 
                        })
    }
    return res.send({ error: true, msg: 'no token provided' })
});
  

router.post('/register', async (req, res) => {

    const captchaService = new CaptchaService()
    let resultCaptcha = await captchaService.checkCaptchaAnswer(req.body.captcha.answer, req.body.captcha.sessionid)

    //si le captcha est incorrect
    if(resultCaptcha.success == false)
        return res.json({ error: true, msg: "CAPTCHA_FAILED" })

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

router.post('/confirm-email/:userId/:emailToken', async (req, res) => {
    //find an existing user by email
    let user = await User.findOne({ _id: req.params.userId });
    if (!user) return res.json({ error: true, msg: "USERID_NOT_FOUND" })
  
    user = await User.findOne({ _id: req.params.userId, emailToken: req.params.emailToken }).populate("plan");
    if (!user) return res.json({ error: true, msg: "TOKEN_NOT_FOUND" })
  
    if (user.emailChecked) 
        return res.json({ error: true, msg: "EMAIL_ALREADY_CHECKED", user: user })
  
    let userService = new UserService()
    user = await userService.confirmEmail(user)

    res.json({ error: false, user: user })
});


router.post('/login', async (req, res) => {
    new Promise((resolve, reject) => { 
        if(req.body.email && req.body.password){
            User.findOne({ 'email' : req.body.email })
                .populate("walletMain").populate("walletsDeposit")
                .populate("plan")
                .populate({
                    path: 'offers',
                    populate: [ { path: 'propositions', 
                                    populate: [{ path: 'negos'}, 
                                                { path: 'userCaller', 
                                                select: ['_id', 'name', 'city', 'coordinates']
                                            }] 
                                },  
                                { path: 'creator',
                                    select: ['_id', 'name', 'city', 'coordinates']
                                }
                                ]
                    })
                .populate({
                    path: 'propositionsSent',
                    populate: [{ path: 'negos'}, 
                                { path: 'offer', 
                                    populate: { path: 'creator',
                                                select: ['_id', 'name', 'city', 'coordinates']
                                            }
                                }, 
                                { path: 'userCaller', 
                                    select: ['_id', 'name', 'city', 'coordinates']}] 
                })
                .then(resolve, reject);
        }else{
            resolve({ error: true })
        }
    }).then(async user => { 
        if(user == null){        
            res.send({  error: true, 
                        errorMsg: 'EMAIL_NOT_FOUND' })
        }
        else if(user.error){     
            res.send({  error: true, 
                        errorMsg: 'LOGIN_ERROR' })
        }
        // else if(user.walletMain == null){     
        //     res.send({  error: true, 
        //                 errorMsg: 'PLAN_ERROR',
        //                 user: user })
        // }
        else if(user != null){   
            bcrypt.compare(req.body.password, user.password, async function(err, bres) {
                if(bres == false){
                    res.send({  error: true, 
                                errorMsg: 'PWD_FAILED' })
                }else{
                    //vérifie si l'adresse email a été confirmée
                    if(!user.emailChecked){     
                        res.send({  error: true, 
                                    errorMsg: 'EMAIL_NOT_CHECKED' })
                    }else if(user.isLocked){     
                        res.send({  error: true, 
                                    errorMsg: 'ACCOUNT_LOCKED' })
                    }else if(user.isDeleted){     
                        res.send({  error: true, 
                                    errorMsg: 'ACCOUNT_DELETED' })
                    }else{
                        //change value of token for this user
                        const token = jwt.sign({ _id: user._id }, config.get('access_pk'))
                        user.accessToken = token 
                        await user.save()

                        user.password = ""
                        user.accessToken = ""

                        let i = await Instance.findOne()
                        let monyConvertValue = i != null ? i.monyConvertValue : 0


                        let myConvs = await Conversation
                                            .find({ '$or': [{ user1: user._id }, 
                                                            { user2: user._id } ] })
                                            .populate({ path: 'user1',
                                                        select: ['_id', 'name', 'city', 'coordinates']
                                                        })
                                            .populate({ path: 'user2',
                                                        select: ['_id', 'name', 'city', 'coordinates']
                                                        })

                        res.send({  error: false, 
                                    token: token, 
                                    user: user, 
                                    monyConvertValue: monyConvertValue,
                                    conversations: myConvs  })
                    }
                }
            });
                      
        }
    }).then(() => {
        
    }, err => console.log(err));
});

module.exports = router;
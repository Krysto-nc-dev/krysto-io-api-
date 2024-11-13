var express = require("express")
var router = express.Router()
const { User, validate } = require('../models/User')
const { WalletMain } = require('../models/WalletMain')
const { WalletDeposit } = require('../models/WalletDeposit')
const { Instance } = require('../models/Instance')

const auth = require("../middleware/auth");
const authAdmin = require("../middleware/auth-admin");

const OtoService = require('../services/oto')
const UserService = require('../services/user')

const { exec } = require('child_process');


//création monétaire
router.get('/create-daily-mony/:rootPk?', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/oto/create-daily-mony")

  let otoService = new OtoService()
  let result = await otoService.createDailyMony()
 
  res.send({ error: false, res: result })
})

//remise à zéro de l'instance (supprime tous les comptes, sauf l'admin)
router.get('/raz', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/oto/raz")

  var result = exec('sh scripts/rebootbdd_prod.sh',
        (error, stdout, stderr) => {
            console.log(stdout);
            console.log(stderr);
            if (error !== null) {
                console.log(`exec error: ${error}`);
            }
        });
        
  // let otoService = new OtoService()
  // let result = await otoService.raz()
 
  res.send({ error: false, res: result })
})

//création d'utilisateur pour effectuer les test/simulation
router.get('/create-sim-users/:nbUsers', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/oto/create-sim-users", req.params.nbUsers)

  let userService = new UserService()
  await userService.createSimUsers(req.params.nbUsers)
 
  res.send({ error: false })
})

//création d'utilisateur pour effectuer les test/simulation
router.get('/rebase', authAdmin, async (req, res) => {
  console.log("--------------------------------")
  console.log("/oto/rebase")

  let otoService = new OtoService()
  let result = await otoService.rebase()
 
  res.send(result)
})

//vérifier l'existance d'un wallet, à partir de son identifiant UID (4 lettres + 2 chiffres)
router.get('/wallet-exists/:uid', auth, async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/oto/wallet-exists")

  let otoService = new OtoService()
  let wallet = await otoService.walletExists(req.params.uid, req.user._id)
  
  res.send({ error: wallet.uid == null, wallet: wallet })
})

//envoyer de la monnaie d'un compte courant à un autre
router.post('/send-mony', auth, async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/oto/send-mony")

  let user = await User.findOne({ _id: req.user._id })
  
  if(user.planPaid != true)
    return res.send({ error: true, msg: 'Plan not paid' })

  const i = await Instance.findOne()

  // FROM_WALLET
  let fromWallet = null 
  if(req.body.fromWalletType == "MAIN") 
    fromWallet = await WalletMain.findOne({ owner: req.user._id, uid: req.body.fromWalletUid })
                                 .populate("owner")
  else 
    fromWallet = await WalletDeposit.findOne({ owner: req.user._id, uid: req.body.fromWalletUid })
                                    .populate("owner")
  
  // TO_WALLET
  let toWallet = null 
  if(req.body.toWalletType == "MAIN") 
    toWallet = await WalletMain.findOne({ uid: req.body.toWalletUid })
                               .populate("owner")
  else 
    toWallet = await WalletDeposit.findOne({ uid: req.body.toWalletUid })
                                  .populate("owner")
    

  let otoService = new OtoService()
  let trans = await otoService.saveTransaction( req.body.amount, 
                                                fromWallet, 
                                                toWallet, 
                                                req.body.libelle, 
                                                i.monyConvertValue)

  res.send({ error: trans == null, trans: trans })
})


module.exports = router;
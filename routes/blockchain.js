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
const BlockchainService = require('../services/blockchain')

//création monétaire
router.get('/get-last-transactions', authAdmin, async (req, res) => {
  // console.log("--------------------------------")
  // console.log("/blockchain/get-last-transactions")

  let blockchainService = new BlockchainService()
  let result = await blockchainService.getLastTransactions()
 
  res.send(result)
})



module.exports = router;
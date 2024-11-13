var express = require("express")
var mongoose = require("mongoose")
var cors = require('cors')

const http = require('http')
const socketIo = require('socket.io')
const ws = require('./socket/socket');

const config = require("config")

var app = express()


mongoose.connect(config.get("db_url") + config.get("db_name"), {useNewUrlParser: true, useUnifiedTopology:true});

require('./models/User');

app.use(function(req, res, next) {
    //console.log("allow origin", config.get("allow_origin"))
    res.header("Access-Control-Allow-Origin", config.get("allow_origin")); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "X-Auth-Token, Origin, X-Requested-With, Content-Type, Accept");
    
    req.ws = ws;
    next();
});

app.use(cors({
    // Check if origin is a registered instance, else deny.
    origin: async (origin, callback) => {
      let origins = config.get("allow_origin")
      if (origin === undefined || origins.indexOf(origin) > -1) {
        return callback(null, true);
      } else {
        console.log(`WARN: Unauthorized CORS origin: ${origin} !`);
        return callback('Origin not allowed by CORS!');
      }
    },
    optionSuccessStatus: 200,
    credentials: true,
    methods: ['OPTIONS', 'HEAD', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['X-Auth-Token', 'X-Init-Token', 'Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
  }));

//use config module to get the privatekey, if no private key set, end the application
if (!config.get("access_pk")) {
    console.error("FATAL ERROR: access_pk is not defined.");
    process.exit(1);
}

var bodyParser = require('body-parser');
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
})); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use('/user', require('./routes/user'))
app.use('/auth', require('./routes/auth'))
app.use('/admin', require('./routes/admin'))
app.use('/data', require('./routes/data'))
app.use('/oto', require('./routes/oto'))
app.use('/market', require('./routes/market'))
app.use('/private', require('./routes/private'))
app.use('/blockchain', require('./routes/blockchain'))
app.use('/report', require('./routes/report'))
app.use('/stat', require('./routes/stat'))
app.use('/pay', require('./routes/pay'))

app.use('/krysto', require('./routes/krysto'))



app.use(express.static('public'));


const httpServer = http.createServer(app)

const wsServer = http.createServer(app)
const ioSocket = socketIo(wsServer, {
  cors: {    
    origin: config.get("allow_origin"),
    methods: ["GET", "POST"],
    credentials: true  
  }
})

ws.init(ioSocket)

// Setup middleware to set ws utils in req.
app.use(function (req, _, next) {
  req.ws = ws;
  next();
});

httpServer.listen(config.get("port"))
wsServer.listen(config.get("portSocket"))


console.log("----------------------------------------------------")
console.log("API started", "http://localhost:"+ config.get("port"))
console.log("----------------------------------------------------")
console.log("SOCKET started", "http://localhost:"+ config.get("portSocket"))
console.log("----------------------------------------------------")
console.log("CHECK IT :", "http://localhost:"+ config.get("port")+"/admin/api-ready")
console.log("----------------------------------------------------")
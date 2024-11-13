const jwt = require("jsonwebtoken");
const config = require("config");
const { User } = require('../models/User')

module.exports = async function(req, res, next) { 
  
  //console.log("req.params", req.params, config.get('root_pk'))
  //accès root pour les script bash
  if(req.params.rootPk == config.get('root_pk')) { next(); return }

  //get the token from the header if present
  const token = req.headers["x-auth-token"];
  //if no token found, return response (without going to the next middelware)
  if (!token) {
    return res.status(401).send("Access denied. No token provided.");
  }
  try {
    //if can verify the token, set req.user and pass to next middleware
    const decoded = jwt.verify(token, config.get("access_pk"));
    req.user = decoded;
    //console.log("decoded", decoded, decoded._id)
    //check if the user is an admin
    let user = await User.findById(decoded._id)
    if(user.isAdmin !== true){
      //if not admin : return error
      console.log("sorry, you are not admin", user)
      return res.status(401).send("Access denied. Sorry, you are not admin.");
    }
    //console.log("ok, you are admin", user)
    //if admin : its ok for you !
    next();
  } catch (ex) {
    console.log("ex", ex)
    //if invalid token
    return res.send({ error: true, message: "Invalid token"} );
  }
};
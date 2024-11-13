
let ws = {
    io: null,
    clients: [],
    init: function(io){
        ws.io = io
        // Quand un client se connecte, on le note dans la console
        ws.io.sockets.on('connect', function (socket) {
            //console.log('Un client est connecté !', ws.clients.length);
            socket.emit("conf-connexion", { msg: "hello" })

            socket.on('join', (data) => {
                //delete older socket if exists
                ws.clients.forEach((c,i)=>{ if(c.UID == data.UID) ws.clients.splice(i, 1) })
                //push new socket
                ws.clients.push({ UID: data.UID, socket : socket })
                //console.log('-------------------------');
                //console.log('JOIN SOCKET !', data.UID);
            });

            socket.on('get-count', (data) => {
                socket.emit("count-connected", { count: ws.clients.length })
                //console.log('count-connected', ws.clients.length);
            });

            socket.on('leave', (data) => {
                //console.log('LEAVE !', data.UID);
                //delete older socket if exists
                ws.clients.forEach((c,i)=>{ if(c.UID == data.UID) ws.clients.splice(i, 1) })
                
            });

        });
    },
    emit: async function(targetUid, action, data){
        //console.log("ws.clients", ws.clients.length, targetUid)
        if(targetUid == null) return
        
        let sock = null
        ws.clients.forEach((c,i)=>{ //console.log("c.UID", c.UID, targetUid)
            if(c.UID == targetUid) sock = c.socket 
        })

        if(sock != null){
            sock.emit(action, data)
            //console.log("local socket send to", action)
        }
    },
    isOnline: function(uid){
        //console.log("isOnline ?", uid)
        let found = false
        ws.clients.forEach((c,i)=>{ //console.log("c.UID", uid)
            if(c.UID == uid){
                found=true 
                //console.log("found :", found)
                return
            }
        })
        return found
    }
    
}
module.exports = ws;
# Simple Servers 
https://github.com/McRain/reneos.server

This package is designed to quickly launch lightweight servers (http or websocket).


## Install

```npm i @reneos/server```

## Usage WebSocket

WsServer - Wrapper for ws package - added convenient pre-authorization support, sub-protocol implementation, network callbacks implemented

```js
import { WsServer } from "@reneos/server"

function Parser(msg, uid){
    if(msg.id){//Message recommends an answer
        _server.sendTo({
            target:0,
			type: 0,
			on: msg.id,
			data: {value:'ANY'}
		}, [userId])
    }
}

/**
	* 
	* @param {*} request 
	* @param {*} socket 
	* @param {*} head 
	* @returns connection ID if allow or NULL if not allow
	*/
function Verify(request, socket, head){
    return request.headers['user'].id
}

const _server = new WsServer()
_server.on("connect", (uid, ws) => {
	console.log(`Connection  (${uid}) connected : (${_server.count} connections)`)
})
_server.on('disconnect', (uid, code, reason) => {
	console.log(`Connection  (${uid}) disconnected : (${_server.count} connections)`)
})
_server.on('upgrade', () => { /*console.log('upgrade')*/ })
_server.on('headers', () => { /*console.log('headers')*/ })
_server.on("message", Parser)
_server.start({port:12345},Verify)
```

## Usage WebServer

```js
import { WebServer } from "@reneos/server"

function Parser(req,res,next){
    const headers = req.headers['x-user']
		next()
}

async function Api(req,res){
	res.cookie = {
		key:'value
	}
	return {
		result:true
	}
}

WebServer.Use(Parser)
WebServer.AddRoute('/api',Api)
WebServer.Run(8080)
```


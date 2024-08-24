import Server from "./server.js"

const _server = new Server()

class StaticServer{
	static Run(port) {
		//_server.on("error", onerror ? onerror : e => console.warn(e.message))
		_server.run(port)
	  }
	
	  static Use(handler, position) {
		return _server.use(handler,position)
	  }
	
	  static AddRouteAt(code, handler) {
		return _server.addRouteAt(code,handler)
	  }
	
	  static AddRoute(path, handler, method = "*") {
		return _server.addRoute(path, handler, method)
	  }
	
	  static Works(req, res) {
		return _server.works(req, res)
		
	  }
	
	  static OnRequest(req, res) {
		return _server.handle(req.res)	
	  }
}

export default new Proxy(StaticServer, {
	get(target, prop) {
		if (target[prop] === undefined)
			return _server[prop]
		return target[prop]
	}
})
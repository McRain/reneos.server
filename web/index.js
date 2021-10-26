import http from "http"

const _middlewares = [
	/**
	 * time
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	(req, res, next) => {
		req.time = Date.now()
		next()
	},
	/**
	 * remoteIp
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	(req, res, next) => {
		try {
			req.remoteIp = (req.headers['x-real-ip'] ||
				req.headers['x-forwarded-for'] ||
				req.connection.remoteAddress ||
				req.socket.remoteAddress ||
				req.connection.socket.remoteAddress).split(",")[0]
		} catch (error) {
			//console.warn(error)
		}
		next()
	},
	/**
	 * protocol,pathname,hash,query
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	(req, res, next) => {
		const u = new URL(req.url, `http://${req.headers.host}`)
		try {
			req.protocol = u.protocol
			req.pathname = u.pathname
			req.hash = u.hash
			req.query = {}
			u.searchParams.forEach((value, name) => {
				req.query[name] = value
			})
		} catch (error) {
			//console.warn(error.message)
		}
		next()
	},
	/**
	 * cookie
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	(req, res, next) => {
		req.cookie = {}
		if (req.headers.cookie) {
			req.headers.cookie.split(';').forEach(cookie => {
				const line = cookie.split('=');
				req.cookie[line.shift().trim()] = decodeURI(line.join('='));
			});
		}
		next()
	}
]

async function Work(request, responce) {
	responce.cookie = {}
	const mwh = i => {
		if (i < _middlewares.length) {
			const h = _middlewares[i]
			h(request, responce, mwh.bind(null, ++i))
		}
	}
	mwh(0)
	const handler = _routes[request.pathname] || _routes["*"] || _routes[""]
	if (!handler) {
		return WebServer.Return404(responce)
	}
	let str = ""
	try {
		const result = await handler(request, responce)
		//if no result - handler must set responce by self !!!
		if (!result) {
			return
		}
		str = JSON.stringify(result)
	} catch (error) {
		//console.warn(error)
		str = "{}"
	}
	WebServer.SetCookies(responce.cookie, responce)
	responce.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
	responce.writeHead(200, { 'Content-type': 'application/json' })
	responce.end(str)
}

async function OnRequest(request, responce) {
	request.body = {}
	if (request.method === 'GET')
		return await Work(request, responce)
	let data = ''
	request.on('data', chunk => data += chunk)
	request.on('end', () => {
		try {
			request.body = JSON.parse(typeof data === 'string' ? data : data.toString('utf8'))
		} catch (error) {
			request.body = {}
		}
		Work(request, responce)
	})
}

let _server = http.createServer(OnRequest)
let _routes = {}

/**
 * Include only public methods
 */
class WebServer {

	/**
	 * Start server
	 * @param {*} port 
	 */
	static Run(port, onerror) {
		//if (_server) WebServer.Stop()	
		_server.on("error", onerror ? onerror : (e) => console.warn(e.message))
		_server.listen(port)
	}

	/**
	 * 
	 * @param {*} values {httpOnly:'true',duration:0,value:'cookievalue'}
	 * @param {*} response 
	 */
	static SetCookies(values = {}, response) {
		const cookies = []
		Object.keys(values).forEach(k => {
			const info = values[k]
			let cook = `${k}=${info.value};httpOnly=${info.httpOnly || 'true'};Path=${info.path || '/'};`
			if (info.duration) {
				cook = `${cook}expires=${new Date(Date.now() + info.duration * 1000).toUTCString()};`
			}
			cookies.push(cook)
		})
		response.setHeader('Cookie', cookies)
		response.setHeader('Set-Cookie', cookies)
	}

	static Return404(responce) {
		responce.writeHead(404)
		responce.end()
	}

	static Stop() {
		if (_server)
			_server.close()
		_middlewares.length = 0
	}

	/**
	 * 
	 * @param {Function} handler (req,res,next) 
	 */
	static Use(handler, first = true) {
		_middlewares[first ? 'unshift' : 'push'](handler)
	}
	/**
	 * 
	 * @param {Object} obj {"/path",(req,res)=>{return {} }}
	 */
	static AddRoutes(obj) {
		Object.keys(obj).forEach(k => {
			_routes[k] = obj[k]
		})
	}

	/**
	 * 
	 * @param {string} key - route 
	 * @param {Function} handler async (req,res)=>{ return {} }
	 * @param {Object} options : {auth:{"jwt":(req,res,next)=>{ next() } }}
	 */
	static AddRoute(key, handler, options) {
		_routes[key] = handler
	}
}

export default WebServer
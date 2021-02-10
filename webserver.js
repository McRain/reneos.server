import http from "http"
import querystring from "querystring"

const _middlewares = []

let _server
let _routes = {}

function Prepare() {
	_middlewares.push((req, res, next) => {
		req.time = Date.now()
		next()
	})
	_middlewares.push((req, res, next) => {
		try {
			req.remoteIp = (req.headers['x-real-ip'] ||
				req.headers['x-forwarded-for'] ||
				req.connection.remoteAddress ||
				req.socket.remoteAddress ||
				req.connection.socket.remoteAddress).split(",")[0]
		} catch (error) {
			console.warn(error)
		}
		next()
	})

	_middlewares.push((req, res, next) => {
		const u = new URL(req.url, `http://${req.headers.host}`)
		try {
			req.pathname = u.pathname
			req.query = querystring.parse(u.search.slice(1))
		} catch (error) {
			console.warn(error.message)
		}
		next()
	})

	_middlewares.push((req, res, next) => {
		req.cookie = {}
		if (req.headers.cookie) {
			req.headers.cookie.split(';').forEach(cookie => {
				const line = cookie.split('=');
				req.cookie[line.shift().trim()] = decodeURI(line.join('='));
			});
		}
	})
}

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
		if(!result)
			return
		str = JSON.stringify(result)
	} catch (error) {
		console.warn(error)
		str = "{}"
	}
	WebServer.SetCookies(responce.cookie, responce)
	responce.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
	responce.writeHead(200, { 'Content-type': 'application/json' })
	responce.end(str)
	//console.log(`Request by ${Date.now() - request.time} msec`)
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


class WebServer {

	/**
	 * Start server
	 * @param {*} port 
	 */
	static Run(port) {
		if (_server)
			WebServer.Stop()
		Prepare()
		_server = http.createServer(OnRequest)
		_server.on("error", e => console.warn(e.message))
		_server.listen(port)
	}

	/**
	 * 
	 * @param {*} values {httpOnly:'true',duration:0,value:'cookievalue'}
	 * @param {*} response 
	 */
	static SetCookies(values, response) {
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
		_middlewares.length=0
	}

	/**
	 * Промежуточный обработчик 
	 * @param {Function} handler (req,res,next) 
	 */
	static Use(handler) {
		_middlewares.push(handler)
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
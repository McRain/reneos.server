import http from "http"
import Workers from './preworkers.js'

const ToMsec = 1000000
const _middlewares = []

let _config = {	multiroutes: false }
let _routes = {}

function Execute(request, responce) {
	if(_middlewares.length>0){
		const mwh = i => {
			const h = _middlewares[i]
			const f = i === _middlewares.length - 1 ? Works.bind(null,request, responce) : mwh.bind(null, ++i)		
			h(request, responce, f)
		}
		mwh(0)
	}else{
		Works(request, responce)
	}
}

async function Works(request, responce) {
	const paths = request.pathname.split('/').filter(p=>p.length>0)
	const handlers = []
	let p = `/`
	for (let i = 0; i < paths.length; i++) {
		p += paths[i]
		const hs = Object.keys(_routes)
			.filter(r => r===`${p}/*`)
			.sort()
			.map(r => _routes[r])
		handlers.push(...hs)
		p += '/'
	}
	const targetRoute = _routes[request.pathname]
	if (targetRoute)
		handlers.push(targetRoute)
	let results
	for (let i = 0; i < handlers.length; i++) {
		try {
			results = await handlers[i](request, responce, results)
		} catch (error) {
			console.warn(error)
			break
		}
	}
	if (!results)
		return
	WebServer.SetCookies(responce.cookie, responce)
	responce.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
	responce.writeHead(200, { 'Content-type': 'application/json' })
	responce.end(JSON.stringify(results))
}

/**
 * Http request handler
 * @param {*} request 
 * @param {*} responce 
 * @returns 
 */
function OnRequest(request, responce) {
	request.body = {}
	responce.cookie = {}

	Workers.forEach(m => m(request, responce))	
	
	if (request.method === "GET") {
		return Execute(request, responce)
	}
	let data = ''
	request.on('data', chunk => data += chunk)
	request.on('end', () => {
		try {
			request.body = JSON.parse(typeof data === 'string' ? data : data.toString('utf8'))
		} catch (error) {
			request.body = {}
		}
		Execute(request, responce)
	})
}

function getMsTime(from) {
	const t = process.hrtime(from)
	return (t[0] * 1e9 + t[1]) / ToMsec
}

let _server = http.createServer(OnRequest)
/**
 * Include only public methods
 */
class WebServer {
	/**
	 * Start server
	 * @param {*} port 
	 */
	static Run(port, options = {}, onerror) {
		if (typeof options === 'function') {
			_server.on("error", options)
		} else {
			_config = { ..._config, ...options }
			_server.on("error", onerror ? onerror : e => console.warn(e.message))
		}
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
	/**
	 * Stop web server and clear middlewares
	 */
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
		Object.keys(obj).forEach(k => _routes[k] = obj[k])
	}
	/**
	 * 
	 * @param {string} key - route 
	 * @param {Function} handler async (req,res)=>{ return {} }
	 */
	static AddRoute(key, handler) {
		_routes[key] = handler
	}
}
export default WebServer
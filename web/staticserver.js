import http from "http"

const _middlewares = [
  (req, res) => {   
    if (req.headers.cookie) {
      req.headers.cookie.split(';').forEach(cookie => {
        const line = cookie.split('=');
        req.cookie[line.shift().trim()] = decodeURI(line.join('='));
      });
    }
  }
]
const _routes = {}
const _standarts = {
  404: (req, res) => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  },
  500: (req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

let _server

class StaticServer {
  static Run(port, onerror) {
    _server = http.createServer(StaticServer.OnRequest)
    _server.on("error", onerror ? onerror : e => console.warn(e.message))
    _server.listen(port)
  }

  static Use(handler, position) {
    const p = position || _middlewares.length
    _middlewares.splice(p, 0, handler)
  }

  static AddRouteAt(code, handler) {
    _standarts[code] = handler
  }

  static AddRoute(path, handler, method = "*") {
    if (!_routes[path]) {
      _routes[path] = {};
    }
    if (!_routes[path][method]) {
      _routes[path][method] = [];
    }
    _routes[path][method].push(handler);
  }

  static Works(req, res) {
    const handlers = []
    const url = req.url || ""
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const routs = [normalizedUrl, `${normalizedUrl}/`]
    for (let i = 0; i < 2; i++) {
      const p = routs[i]
      if (_routes[p]) {
        handlers.push(..._routes[p][req.method] || [], ..._routes[p]['*'] || [])
      }
    }

    if (handlers.length === 0) {      
      _standarts[404](req, res)
      return;
    }
    try {
      const cnt = handlers.length
      for (let i = 0; i < cnt; i++) {
        handlers[i](req, res);
      }
    } catch (error) {
      _standarts[500](req, res)
    }
  }

  static async OnRequest(req, res) {
    req.cookie = {}
    res.cookie = {}
    req.time = process.hrtime()
    const end = res.writeHead
    res.writeHead = (...args) => {
      const cookies = []
      Object.keys(res.cookie).forEach(k => {
        const info = res.cookie[k]
        let cook = `${k}=${info.value};httpOnly=${info.httpOnly || 'true'};Path=${info.path || '/'};`
        if (info.duration) {
          cook = `${cook}expires=${new Date(Date.now() + info.duration * 1000).toUTCString()};`
        }
        cookies.push(cook)
      })
      res.setHeader('Cookie', cookies)
      res.setHeader('Set-Cookie', cookies)

      const endTime = process.hrtime(req.time)
      res.time = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2)

      end.apply(res, args)
    }

    for (let i = 0; i < _middlewares.length; i++) {
      try {
        _middlewares[i](req, res)
      } catch (error) {
        return
      }
    }
    StaticServer.Works(req, res)


    /*for (const middleware of _middlewares) {
      try {
        await middleware(req, res);
      } catch (error) {
        _standarts[500](req, res)
      }
    }

    let handlers = []
    const url = req.url || ""
    const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;

    const routs = [normalizedUrl, `${normalizedUrl}/`, `${normalizedUrl}/*`, `${normalizedUrl}*`]
    for (let i = 0; i < 4; i++) {
      const p = routs[i]
      if (_routes[p]) {
        const formethod = _routes[p][req.method] || []
        const allmethod = _routes[p]['*'] || []
        handlers.push(...formethod, ...allmethod)
      }
    }

    if (handlers.length === 0) {
      _standarts[404](req, res)
      return;
    }

    try {
      for (const handler of handlers) {
        await handler(req, res);
      }
    } catch (error) {
      _standarts[500](req, res)
    }*/

  }
}

export default StaticServer
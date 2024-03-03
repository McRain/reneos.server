import EventEmitter from "events"
import http from "http"
import fs from "fs"

const _emmiter = new EventEmitter()

class WebServer {
    constructor() {
        this.port = 80
        this.middlewares = [(req, res) => {
            req.cookie = {}
            res.cookie = {}
            if (req.headers.cookie) {
                req.headers.cookie.split(';').forEach(cookie => {
                    const line = cookie.split('=');
                    req.cookie[line.shift().trim()] = decodeURI(line.join('='));
                });
            }
        }, (req, res) => {
            try {
                req.body = JSON.parse(typeof req.data === 'string' ? req.data : req.data.toString('utf8'))
            } catch (error) {
                req.body = {}
            }
        }]
        this.routes = {}
        this.standarts = {
            404: (req, res) => {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            },
            500: (req, res) => {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            }
        }
        this.server = http.createServer(this.handle.bind(this))
        this.root = null
        this.allowExts = []
    }

    run(port) {
        this.port = port
        return this.listen()
    }

    use(handler, position) {
        const p = position || this.middlewares.length
        this.middlewares.splice(p, 0, handler)
    }

    addRouteAt(code, handler) {
        this.standarts[code] = handler
    }

    addRoute(path, handler, method = "*") {
        if (!this.routes[path]) {
            this.routes[path] = {};
        }
        if (!this.routes[path][method]) {
            this.routes[path][method] = [];
        }
        this.routes[path][method].push(handler);
    }

    listen() {
        this.server.listen(this.port, () => {
            _emmiter.emit('start')
        })
    }

    streamFile(path, res) {
        try {
            const filePath = path.replace(/\.\./g, '')
            const fileLocalPath = `${this.root}${filePath}`
            const fileStream = fs.createReadStream(fileLocalPath)
            const fileName = filePath.split('/').pop()
            const fileStats = fs.statSync(fileLocalPath);
            const fileSize = fileStats.size;
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=${fileName}`,
                'Content-Length': fileSize.toString()
            })
            fileStream.pipe(res)
            fileStream.on('end', () => res.end())
            fileStream.on('error', (err) => {
                console.warn("fileStream.on('error'");
                console.warn(err);
                res.statusCode = 500;
                res.end('Internal Server Error')
            })
        } catch (error) {
            console.warn(error)
            return true
        }
        return true
    }

    async works(req, res) {
        await Promise.allSettled(this.middlewares.map(mw => mw(req, res)))
        let handlers = []
        const url = req.path || ""
        const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const routs = ["*", normalizedUrl, `${normalizedUrl}/`]
        for (let i = 0; i < 3; i++) {
            const p = routs[i]
            if (this.routes[p]) {
                const keys = Object.keys(this.routes[p])
                for(let k=0;k<keys.length;k++){
                    const key = keys[k]
                    if(key.includes(req.method) || key==="*"){
                        handlers.push(...this.routes[p][key])
                    }
                }
                /*
                handlers.push(
                    ...this.routes[p][req.method] || [],
                    ...this.routes[p]['*'] || [])*/
            }
        }
        if (handlers.length === 0) {
            //check files
            const ext = url.split('.').pop()
            if (this.allowExts.includes(ext) || this.allowExts.includes("*")) {
                if (this.streamFile(normalizedUrl, res)) {
                    return
                }
            }
            this.standarts[404](req, res)
            const endTime = process.hrtime(req.time)
            res.time = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2)
            return;
        }
        let results = {}
        try {
            const cnt = handlers.length
            for (let i = 0; i < cnt; i++) {
                //handlers[i](req, res)
                const result = await handlers[i](req, res, results)
                if (typeof result === "object")
                    results = { ...results, ...result }
                else if (typeof result === "string")
                    results = result
                else if (!result) {
                    results = result
                }
            }
        } catch (error) {
            this.standarts[500](req, res)
            return
        }
        if (results === null || results === undefined) {
            return
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (typeof results === "object") {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(results));
        } else {
            res.writeHead(200);
            res.end(results || "");
        }
    }

    handle(req, res) {
        req.time = process.hrtime()
        req.cookie = {}
        res.cookie = {}
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
        req.path = parsedUrl.pathname
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());
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
        req.data = ''
        req.on('data', chunk => req.data += chunk)
        req.on('end', () => {
            this.works(req, res)
        })
    }

}

export default WebServer
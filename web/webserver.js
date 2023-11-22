import http from "http"

class WebServer {
    constructor(port) {
        this.port = port
        this.middlewares = [(req, res, next) => {
            req.cookie = {}
            res.cookie = {}
            if (req.headers.cookie) {
                req.headers.cookie.split(';').forEach(cookie => {
                    const line = cookie.split('=');
                    req.cookie[line.shift().trim()] = decodeURI(line.join('='));
                });
            }
            next()
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
        this.server = http.createServer((req, res) => this.handle(req, res))
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
            console.log(`Server listening on port ${this.port}`);
        });
    }

    async works(req, res) {
        let handlers = []
        const url = req.url || ""
        const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const routs = [normalizedUrl, `${normalizedUrl}/`]
        for (let i = 0; i < 2; i++) {
            const p = routs[i]
            if (this.routes[p]) {
                handlers.push(
                    ...this.routes[p][req.method] || [],
                    ...this.routes[p]['*'] || [])
            }
        }

        if (handlers.length === 0) {
            this.standarts[404](req, res)
            const endTime = process.hrtime(req.time)
            res.time = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2)
            return;
        }
        try {
            const cnt = handlers.length
            for (let i = 0; i < cnt; i++) {
                handlers[i](req, res)
            }
        } catch (error) {
            this.standarts[500](req, res)
        }
    }

    async handle(req, res) {
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

        const mwh = i => {
            const h = this.middlewares[i]
            const f = i === this.middlewares.length - 1 ? this.works.bind(this, req, res) : mwh.bind(this, ++i)
            h(req, res, f)
        }
        mwh(0)


    }

}

export default WebServer
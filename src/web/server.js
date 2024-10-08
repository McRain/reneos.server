import EventEmitter from "events"
import http from "http"
import fs from "fs"
import path from 'path'

const _emmiter = new EventEmitter()

function parseFileData(contentType, req) {
    try {
        const boundary = contentType.split('; ')[1].split('=')[1];
        const parts = req.data.split(`--${boundary}`);
        req.files = {}
        parts.forEach(part => {
            // Находим заголовок Content-Disposition, который содержит имя файла
            const match = /Content-Disposition:.*filename="(.*)"/.exec(part);
            if (match) {
                // Найден файл
                const fileName = match[1].trim();

                // Ищем позицию начала данных файла
                const start = part.indexOf('\r\n\r\n') + 4;

                // Получаем данные файла и сохраняем его
                const fileData = part.substring(start, part.length - 2); // Избегаем последнего boundary
                req.files[fileName] = fileData
                //const result = fs.writeFileSync(`./${fileName}`, fileData)
                //console.log(result)
            }
        });
    } catch (error) {
        console.warn(error)
    }
}

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

    addRoute(p, handler, method = "*") {
        if (!this.routes[p]) {
            this.routes[p] = {};
        }
        if (!this.routes[p][method]) {
            this.routes[p][method] = [];
        }
        this.routes[p][method].push(handler);
    }

    listen() {
        this.server.listen(this.port, () => {
            _emmiter.emit('start')
        })
    }

    streamFile(p, res) {
        try {
            const filePath = p.replace(/\.\./g, '')
            const fileLocalPath = `${this.root}${filePath}`
            if (!fs.existsSync(fileLocalPath)) {
                return false
            }

            const contentType = this.getContentType(fileLocalPath);

            const fileStream = fs.createReadStream(fileLocalPath)
            const fileName = filePath.split('/').pop()
            const fileStats = fs.statSync(fileLocalPath);
            const fileSize = fileStats.size;
            const headers = {
                'Content-Type': contentType,//'application/octet-stream',
                'Content-Length': fileSize.toString()
            }
            if (contentType === 'application/octet-stream') {
                headers['Content-Disposition'] = `attachment; filename=${fileName}`
            }
            res.writeHead(200, headers)
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
            return false
        }
        return true
    }

    getContentType(filePath) {
        const extname = path.extname(filePath);
        switch (extname) {
            case '.html':
                return 'text/html';
            case '.css':
                return 'text/css';
            case '.js':
                return 'text/javascript';
            case '.json':
                return 'application/json';
            case '.png':
                return 'image/png';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            default:
                return "application/octet-stream"//'text/plain';
        }
    }

    async works(req, res) {
        const result = await Promise.allSettled(this.middlewares.map(mw => mw(req, res)))
        if (result.some(v => v.value === true))
            return
        let handlers = []
        const contentType = req.headers['content-type']
        if (contentType) {
            if (contentType.startsWith('multipart/form-data')) {
                parseFileData(contentType, req)
            }
        }

        const url = req.path || ""
        const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const routs = ["*", normalizedUrl, `${normalizedUrl}/`]
        for (let i = 0; i < 3; i++) {
            const p = routs[i]
            if (this.routes[p]) {
                const keys = Object.keys(this.routes[p])
                for (let k = 0; k < keys.length; k++) {
                    const key = keys[k]
                    if (key.includes(req.method) || key === "*") {
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


            const fileUrl = url.endsWith('/') ? `${url}index.html` : url
            if (this.streamFile(fileUrl, res)) {
                return
            }
            const ext = fileUrl.split('.').pop()
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
        
        if (typeof results === "object") {
            //res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
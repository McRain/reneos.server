
export default {
    "remoteip": (req, res) => {
        try {
            req.remoteIp = (req.headers['x-real-ip'] ||
                req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress).split(",")[0]
        } catch (error) {
            //console.warn(error)
        }
    },
    "urldata": (req, res) => {
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
    }
}
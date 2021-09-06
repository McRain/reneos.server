import http from "http"
import querystring from "querystring"
import { EventEmitter } from "events"

import { WebSocketServer } from "ws"

const _clientOptions = {
	binary: false, mask: false
}

class Server extends EventEmitter {

	get port() {
		return this.config.port
	}

	get count() {
		return this.connections.length
	}

	constructor() {
		super()
		this.config = {
			port: 8999,
			protocol: "http"
		}
		this.connections = []
	}

	allow(request, socket, head) {
		return Server.GenId(32)
	}

	start(config, verify) {

		this.verify = verify || this.allow

		this.config = {
			port: 8999,
			protocol: "http",
			...config
		}

		this.server = http.createServer()
		this.server.on("error", e => console.warn(e.message))

		this.ws = new WebSocketServer({ noServer: true })

		this.ws.on('connection', this.onClientConnect.bind(this))
		this.ws.on('upgrade', this.emit.bind(this, 'upgrade'))
		this.ws.on("headers", this.emit.bind(this, 'headers'))
		this.ws.on("error", this.emit.bind(this, "error"))
		this.ws.on('close', this.emit.bind(this, "close"))
		this.ws.on('listening', this.emit.bind(this, "listening"))

		this.server.on('upgrade', this.Upgrade.bind(this))
		this.server.listen(this.config.port)

		return this
	}

	async Upgrade(request, socket, head) {
		const u = new URL(request.url, `${this.config.protocol}://${request.headers.host}`)
		request.query = querystring.parse(u.search.slice(1))
		//internal or external verify	
		const id = await this.verify(request, socket, head)
		if (!id) {
			socket.destroy()
			return
		}
		this.ws.handleUpgrade(request, socket, head, this.onWsUpgrade.bind(this, id))
	}

	onWsUpgrade(id, ws) {
		this.ws.emit('connection', ws, id);
	}

	onClientConnect(ws, id) {
		const old = this.connections.find(c => c.id === id)
		if (old) {
			old.client.close()
		}
		const conn = new Connection(ws, id)
		ws.on("error", this.emit.bind(this, "error", conn))
		ws.on("message", this.onMessage.bind(this, conn));
		ws.on("close", this.onClose.bind(this, conn))

		this.connections.push(conn)

		this.emit("connect", id, conn);
	}

	onClose(conn, code, reason) {
		const index = this.connections.indexOf(conn)
		if (index >= 0)
			this.connections.splice(index, 1)
		this.emit("disconnect", conn.id, code, reason)
	}

	onMessage(conn, msg) {
		let message;
		try {
			message = JSON.parse(msg)
		} catch (e) {
			this.emit('message', msg, conn.id)
			return
		}
		this.emit("message", message, conn.id);
	}

	/**
	 * Searches for connections with required parameters
	 * @param {*} filter 
	 */
	find(filter) {
		return this.connections.filter(c => {
			Object.keys(filter).forEach(k => {
				if (c[k] !== filter[k])
					return false
			})
			return true
		})
	}

	/**
	 * 
	 * @param {Object} filters :{id:'sadjhaksjdh'}
	 * @returns 
	 */
	exclude(filter = {}) {
		return this.connections.filter(c => {
			Object.keys(filter).forEach(k => {
				if (c[k] === filter[k])
					return false
			})
			return true
		})
	}

	/**
	 * 
	 * @param {*} data 
	 * @param {*} excludes 
	 */
	write(data, excludes) {
		const targets = this.exclude(excludes)
		targets.forEach(c => c.send(JSON.stringify(data)))
	}

	/**
	 * 
	 * @param {object} data 
	 * @param {object} excludes key:value
	 */
	send(data, excludes) {
		const msg = JSON.stringify(data)
		const targets = this.exclude(excludes)
		targets.forEach(c => c.send(msg))
	}
	sendToAll(data) {
		this.connections.forEach(c => c.send(JSON.stringify(data)))
	}
	sendTo(data, recivers) {
		const targets = this.connections.filter(c => {
			return recivers.includes(c.id)
		})
		targets.forEach(c => c.send(JSON.stringify(data)))
	}

	sendToOne(data, target) {
		const t = targets.find(c => c.id === target)
		if (t) {
			try {
				t.send(data)
			} catch (error) {
				console.warn(error)
			}
		}
	}

	static GenId(len = 12) {
		const sym = "ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
		let str = "";
		for (let i = 0; i < len; i++)
			str += sym[Math.floor(Math.random() * sym.length)]
		return str;
	}
}

class Connection extends EventEmitter {
	/**
	 * 
	 * @param {*} ws - Client socket
	 * @param {*} connId Unique id for this connection
	 */
	constructor(ws, id) {
		super()
		this.id = id
		this.client = ws
		this.callbacks = []
	}

	get ready() {
		return this.client !== null && this.client.readyState === 1
	}

	addCallback(msgId, cb) {
		this.callbacks.push({
			callback: cb,
			id: msgId,
			time: Date.now()
		})
	}

	getCallback(msgId) {
		return this.callbacks.find(c => c.id === msgId)
	}

	getCallbacks(backTimeMs) {
		const dn = Date.now() - backTimeMs
		return this.callbacks.find(c => c.time < dn)
	}

	removeCallback(msgId) {
		this.callbacks = this.callbacks.filter(c => c.id !== msgId)
	}

	clean(backTimeMs) {
		const dn = Date.now() - backTimeMs
		this.callbacks = this.callbacks.filter(c => c.time >= dn)
	}

	send(value) {
		if (this.client !== null && this.client.readyState === 1/*WebSocket.OPEN*/) {
			try {
				this.client.send(value, _clientOptions, () => { });
			} catch (e) {
				this.emit('error', e)
			}
		}
	}
}

export default Server
import { EventEmitter } from "events"
import WebSocket from "ws"

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
			local: true,
			field: ""
		}
		this.connections = []
	}

	start(config, verify) {
		if (config)
			this.config = {
				port: 8999,
				local: true,
				field: 'user',
				head: 'x-user',
				...config
			};

		const opt = {
			verifyClient: (info, cb) => {
				return cb(true, 200, "OK");
			}
		};
		if (verify)
			opt.verifyClient = verify
		if (this.config.local) {
			opt.port = this.config.port;
		}
		this.ws = new WebSocket.Server(opt);

		this.ws.on('connection', this.onClientConnect.bind(this));
		this.ws.on('upgrade', this.emit.bind(this, 'upgrade'))
		this.ws.on("headers", this.emit.bind(this, 'headers'))
		/*this.ws.on("headers", ()=>{
			console.log('headers')
		})
		this.ws.on("upgrade", ()=>{
			console.log('upgrade')
		})*/
		this.ws.on("error", this.emit.bind(this, "error"));
		this.ws.on('close', () => {
			//console.log('close')
		})
		this.ws.on('listening', () => {
			//console.log('listening')
		})
		if (!this.config.local)
			this.server.listen(this.config.port);
		return this
	}

	onClientConnect(ws, req) {
		const info = req[this.config.field]
		const conn = new Connection(ws, req.id, info)
		ws.on("error", this.emit.bind(this, "error", conn))
		ws.on("message", this.onMessage.bind(this, conn));
		ws.on("close", this.onClose.bind(this, conn))

		this.connections.push(conn)

		this.emit("connect", info, conn);
	}

	onClose(conn, code, reason) {
		this.connections = this.connections.filter(cn => cn.id !== conn.id)
		this.emit("disconnect", conn, code, reason)
	}

	onMessage(conn, msg) {
		let message;
		try {
			message = JSON.parse(msg)
		} catch (e) {
			this.emit('message', msg, conn.id, conn.clientId)
			return
		}
		this.emit("message", message, conn.id, conn.clientId, conn.info);
	}

	/**
	 * Searches for connections with required parameters
	 * @param {*} filter 
	 */
	find(filter) {
		return this.connections.filter(c => {
			Object.keys(filter).forEach(k => {
				if (c.info[k] !== filter[k])
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
				if (c.info[k] === filter[k])
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

	genId(len = 12) {
		const sym = "ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
		let str = "";
		for (let i = 0; i < len; i++)
			str += sym[Math.floor(Math.random() * sym.length)]
		return str;
	}
}

const _connClient = Symbol()
const _connId = Symbol()

class Connection {
	/**
	 * 
	 * @param {*} ws - Client socket
	 * @param {*} connId Unique id for this connection
	 * @param {*} parameters any parameters for filter on send by parameters
	 */
	constructor(ws, connId, info) {
		this[_connId] = connId
		this[_connClient] = ws
		this.callbacks = []
		this.info = info
	}

	/**
	 * User ID
	 */
	get clientId() {
		return this.info.id
	}

	/**
	 * Unique id for this connection
	 */
	get id() {
		return this[_connId]
	}

	get client() {
		return this[_connClient];
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

	send(str) {
		if (this.client !== null && this.client.readyState === 1/*WebSocket.OPEN*/) {
			try {
				this.client.send(str, { binary: false, mask: false }, () => { });
			} catch (e) {

			}
		}
	}
}

export default Server
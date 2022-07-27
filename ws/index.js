import http from "http"
import { EventEmitter } from "events"

import { WebSocketServer } from "ws"

import { Generate } from "../tools.js"
import Connection from "./connection.js"

import WsClient from './client.js'

const _config = {
	port: 8999,
	protocol: "http",
	single: false
}

class Server extends EventEmitter {

	get port() {
		return this.config.port
	}

	get count() {
		return this.connections.length
	}

	static get Connection(){
		return Connection
	}

	static get Client() {
		return WsClient
	}

	constructor() {
		super()
		this.config = {
			..._config
		}
		this.connections = []
		this.verify = this.allow

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
	}


	start({ port, protocol, single }, verify) {
		if (typeof verify === "function")
			this.verify = verify
		this.config = {
			..._config,
			port, protocol, single
		}

		this.server.listen(this.config.port)

		return this
	}

	//#region  Private

	allow(request, socket, head) {
		return Generate(32)
	}

	/**
	 * 
	 * @param {*} request 
	 * @param {*} socket 
	 * @param {*} head 
	 * @returns 
	 */
	async Upgrade(request, socket, head) {
		const u = new URL(request.url, `${this.config.protocol}://${request.headers.host}`)
		request.query = {}
		for (const [key, value] of u.searchParams.entries()) {
			request.query[key] = value
		}
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
		ws.on("pong", () => ws.isAlive = true)

		this.connections.push(conn)

		this.emit("connect", id, conn);
	}

	onClose(conn, code, reason) {
		const index = this.connections.indexOf(conn)
		if (index >= 0)
			this.connections.splice(index, 1)
		this.emit("disconnect", conn.id, code, reason,conn)
	}

	async onMessage(conn, msg) {
		this.emit("message", msg, conn.id);
	}

	//#endregion



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

	getConnection(id){
		return this.connections.find(c=>c.id===id)
	}

	closeConnection(target) {
		const t = this.connections.find(c => c.id === target)
		if (!t)
			return
		this.connections = this.connections.filter(c => c.id !== target)
		t.close()

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
		targets.forEach(c => c.send(data))
	}

	/**
	 * 
	 * @param {object} data 
	 * @param {object} excludes key:value
	 */
	send(data, excludes) {
		const targets = this.exclude(excludes)
		targets.forEach(c => c.send(data))
	}
	sendToAll(data) {
		this.connections.forEach(c => c.send(data))
	}
	ping() {
		this.connections.forEach(c => {
			if (c?.client?.isAlive === false)
				return c.close(true)
			c.client.isAlive = false
			c.client.ping();
		});
	}
	/**
	 * 
	 * @param {*} data :Buffer or string
	 * @param {*} recivers 
	 */
	sendTo(data, recivers) {
		for (let i = this.connections.length - 1; i >= 0; i--) {
			const conn = this.connections[i]
			if (recivers.includes(conn.id))
				conn.send(data)
		}
	}

	sendToOne(data, target) {
		const t = this.connections.find(c => c.id === target)
		if (t) {
			try {
				t.send(data)
			} catch (error) {
				console.warn(error)
			}
		}
	}
}

export default Server
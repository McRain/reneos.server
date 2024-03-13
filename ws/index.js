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
	 * Searches for connections with required parameters
	 * if include===true - will return all connections that HAVE matching properties found
	 * if include===false - will return all connections that do NOT HAVE matching properties
	 * @param {*} filter 
	 * @param {Boolean} include
	 */
	filter(values={},include=false){
		return this.connections.filter(c => {
			const keys = Object.keys(values)
			for(let i=0;i<keys.length;i++){
				const key = keys[i]
				if (c[key] === values[key])
					return include
			}
			return !include
		})
	}

	/**
	 * Send a message to everyone except those listed 
	 * @param {object} data 
	 * @param {object} excludes key:value
	 */
	send(data, excludes={}) {
		const targets = this.filter(excludes,false)
		targets.forEach(c => c.send(data))
	}

	/**
	 * Sending a message to those specified in the list
	 * @param {*} data 
	 * @param {*} includes {id:'OnlyOne'}
	 */
	sendTo(data, includes) {
		const targets = this.filter(includes,true)
		targets.forEach(c => c.send(data))
	}
	ping() {
		this.connections.forEach(c => {
			if (c?.client?.isAlive === false)
				return c.close(true)
			c.client.isAlive = false
			c.client.ping();
		});
	}
	
}

export default Server
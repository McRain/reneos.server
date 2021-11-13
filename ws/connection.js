import { EventEmitter } from "events"

const _clientOptions = {
	binary: false, mask: false
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

	close(terminate = false) {
		if(terminate){
			this.client?.terminate()
		}else
			this.client?.close()
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

	async send(value) {
		if (this.client !== null && this.client.readyState === 1/*WebSocket.OPEN*/) {
			try {
				this.client.send(value, _clientOptions, () => { });
			} catch (e) {
				this.emit('error', e)
			}
		}
	}
}

export default Connection

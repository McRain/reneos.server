import {EventEmitter} from "events"

import WebSocket from "ws"

class Client extends EventEmitter{
	get id(){
		return this._id
	}

	get connected(){
		return this._ws && this._ws.connected
	}

	constructor(id){
		super()
		this._ws = null
		this._id = id
	}

	/**
	 * 
	 * @param {*} config 
	 * @param {*} options (headers)
	 */
	connect({url="ws://127.0.0.1:11000",reconect=true,delay=5},options={}){
		this._ws = new WebSocket(url, options)
		
		this._ws.on('open',  this.emit.bind(this,"connect"))
		this._ws.on("upgrade",this.onUpgrade.bind(this))
		this._ws.on('message', this.emit.bind(this,"message"))

		this._ws.on('close', (code, reason) => {
			if(code!==1005 && reconect)
				setTimeout(this.connect.bind(this,{url,reconect,delay},options), delay * 1000)
			else
				this.emit.bind(this,'close', code, reason)
		});
		
		this._ws.on('error', this.emit.bind(this,'error'));
	}

	onUpgrade(request){
	}

	onOpen(a,b,c){
		this.emit('connect')
	}

	/**
	 * 
	 * @param {String || Buffer} data 
	 * @returns {Boolean}
	 */
	send(data){
		if (!this._ws || this._ws.readyState !== 1) {
			return false
		}
		try {
			this._ws.send(data)
		} catch (e) {
			return false
		}
		return true
	}

	/**
	 * @deprecated Use "send"
	 * @param {*} value 
	 * @returns 
	 */
	write(value) {
		if (!this._ws || this._ws.readyState !== 1) {
			return false
		}
		try {
			this._ws.send(value)
		} catch (e) {
			return false
		}
		return true
	}

	close(code) {
		if(this._ws)
			this._ws.close(code)
	}
}

export default Client
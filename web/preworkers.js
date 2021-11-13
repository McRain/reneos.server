const _workers = [
	/**
		* time
		* @param {*} req 
		* @param {*} res 
		* @param {*} next 
		*/
		req => {
			req.time = Date.now()
			req.hrtime = process.hrtime()
		},
		/**
		 * remoteIp
		 * @param {*} req 
		 * @param {*} res 
		 * @param {*} next 
		 */
		req => {
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
		/**
		 * protocol,pathname,hash,query
		 * @param {*} req 
		 * @param {*} res 
		 * @param {*} next 
		 */
		req => {
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
		},
		/**
		 * cookie
		 * @param {*} req 
		 * @param {*} res 
		 * @param {*} next 
		 */
		req => {
			req.cookie = {}
			if (req.headers.cookie) {
				req.headers.cookie.split(';').forEach(cookie => {
					const line = cookie.split('=');
					req.cookie[line.shift().trim()] = decodeURI(line.join('='));
				});
			}
		}
]
export default _workers
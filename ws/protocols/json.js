const server = {}
const client  = {}
function decode(options,msg,uid){
	return JSON.parse(msg)
}

function encode(data,uid){
	return JSON.stringify(data)
}

export default {
	decode,encode,server,client
}
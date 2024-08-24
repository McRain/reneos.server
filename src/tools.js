const sym = "ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";

function Generate(len = 12) {	
	let str = ''
	for (let i = 0; i < len; i++)
		str += sym[Math.floor(Math.random() * sym.length)]
	return str
}

export {
	Generate
}
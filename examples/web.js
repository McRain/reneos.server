import { WebServer,Middlewares } from '../web/index.js'

// Usage:
const server = new WebServer(3000);

// Middleware to log the request method and url
server.use((req, res, next) => {
  //console.log(`${req.method} ${req.url}`);
  next(); // Proceed to next middleware or route handler
});

server.use(Middlewares.remoteip)

// Adding route handlers

//EQAUL '/'
server.addRoute('', async (req, res) => {
  //console.log(req.time)
}, "GET");


server.addRoute('/', async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Hello, World!')
}, "GET");



server.addRoute('/about', async (req, res) => {
  res.cookie['my'] = {value:"OK",httpOnly:true,path:'/'}
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('About Us');
});

server.addRoute('/about/', async (req, res) => {
  //console.log(req.cookie)
  console.log(req.remoteIp)
});

// Start the server
server.listen();
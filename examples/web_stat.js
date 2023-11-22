import { StaticServer,Middlewares } from '../web/index.js'

// Middleware to log the request method and url
StaticServer.Use((req, res) => {
    console.log(`${req.method} ${req.url}`);
     // Proceed to next middleware or route handler
  });
  
  StaticServer.Use(Middlewares.remoteip)
  
  StaticServer.AddRoute('', async (req, res) => {
    console.log(req.time)
  }, "GET");

  // Adding route handlers
  StaticServer.AddRoute('/', async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Hello, World!')
  }, "GET");
  
 
  StaticServer.AddRoute('/about', async (req, res) => {
    res.cookie['my'] = {value:"OK",httpOnly:true,path:'/'}
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('About Us');
  });
  
  StaticServer.AddRoute('/about/', async (req, res) => {
    //console.log(req.cookie)
    console.log(req.remoteIp)
  });

  StaticServer.Run(3001)
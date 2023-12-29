import { StaticServer,Middlewares } from '../web/index.js'

// Middleware to log the request method and url
StaticServer.Use((req, res) => {
    console.log(`${req.method} ${req.url}`);
     // Proceed to next middleware or route handler
  });
  
  StaticServer.Use(Middlewares.remoteip)
  
  StaticServer.AddRoute('', async (req, res,result) => {
    console.log(req.time)
    console.log(req.body)
    console.log(req.cookie)
    return {
      "key":"value"
    }
  }, "GET");

  // Adding route handlers
  StaticServer.AddRoute('/', async (req, res,result) => {
    return 'Hello, World!'
  }, "GET");
  
 
  StaticServer.AddRoute('/about', async (req, res,result) => {
    res.cookie['my'] = {value:"OK",httpOnly:true,path:'/'}
    return ""
  });
  
  StaticServer.AddRoute('/about/', async (req, res) => {
    console.log(req.cookie)
    console.log(req.remoteIp)
  });

  StaticServer.Run(3001)
const express = require("express");
const routerV1 = new express.Router();
const userAuth = require("../controllers/Authorization");
const CallControl = require("../controllers/CallController");


//user auth
routerV1.get("/user",userAuth.userDetails);
routerV1.patch("/user",userAuth.updateUser);
routerV1.delete("/user/:id",userAuth.deleteUser);

routerV1.post('/generateToken', CallControl.generateToken );
routerV1.post('/createRoom', CallControl.createRoom );
routerV1.post('/startCall', CallControl.startCall );
routerV1.get('/getCallInfo/:roomId', CallControl.getCallInfo );
routerV1.post('/endCall', CallControl.endCall );
routerV1.post('/declineCall', CallControl.declineCall );

module.exports = routerV1;
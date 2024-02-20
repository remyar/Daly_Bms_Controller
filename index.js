const express = require('express');
var cors = require('cors');
const app = express();


const { SerialPort } = require('serialport');
const Controller = require('./controller');

global.Controllers = [];

async function scanAllControllers() {

    try {
        let _ports = [];
        if (process.platform === "win32") {
            _ports = (await SerialPort.list()).filter((el) => el.friendlyName.includes("CH340"));
        } else {
            _ports.push({ path: "/dev/ttyUSB0" });
        }

        global.Controllers = [];

        for (let i = 0; i < _ports.length; i++) {
            let settings = {
                baudrate: 9600,
                port: _ports[i].path
            }
            global.Controllers.push(new Controller(settings));
        }

        for (let i = 0; i < global.Controllers.length; i++) {
            await global.Controllers[i].connect();
        }
        
        //-- all controlleur is normaly connected and read data every second

    }catch(err){
        console.error("No Controller Found !!");
    }

}

app.use(express.json())    // <==== parse request body as JSON
app.options('*', cors()) // include before other routes

app.use('/', cors(), require('./routes'));

app.listen(3005, async () => {
    console.log("Serveur à l'écoute");
    //global.logging = await file.readGlobalSettings();
    await scanAllControllers();

});

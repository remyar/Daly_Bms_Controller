const { SerialPort } = require('serialport');
const Controller = require('./controller');

global.Controllers = [];

async function scanAllControllers() {

    try {
        let _ports = [];
        if (process.platform === "win32") {
            _ports = (await SerialPort.list()).filter((el) => el.friendlyName.includes("Prolific"));
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
        
    }catch(err){
        console.error("No Controller Found !!");
    }

}

scanAllControllers();
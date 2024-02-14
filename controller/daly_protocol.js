const { SerialPort } = require('serialport');
const { ByteLengthParser } = require('@serialport/parser-byte-length')

class Protocol {

    VOUT_IOUT_SOC = 0x90;
    MIN_MAX_CELL_VOLTAGE = 0x91;
    MIN_MAX_TEMPERATURE = 0x92;
    DISCHARGE_CHARGE_MOS_STATUS = 0x93;
    STATUS_INFO = 0x94;
    CELL_VOLTAGES = 0x95;
    CELL_TEMPERATURE = 0x96;
    CELL_BALANCE_STATE = 0x97;

    constructor(settings) {
        this.serialPortCom = new SerialPort({ path: settings?.port || "COM1", autoOpen: false, baudRate: parseInt(settings?.baudrate ? settings?.baudrate : 9600) });
        this.parser = this.serialPortCom.pipe(new ByteLengthParser({ length: 13 }));
        this.frames = [];
        this.parser.on('data', (chunk) => {
            this.frames.push([...chunk]);
        });

    }

    async open() {
        return new Promise(async (resolve, reject) => {
            if (this.serialPortCom.isOpen == true) {
                resolve();
            } else {
                try {
                    this.serialPortCom.open(err=>{
                        if ( err){
                            reject();
                            return;
                        }
                        resolve();
                    });
                 
                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            }
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.serialPortCom.isOpen == false) {
                resolve();
            } else {
                this.serialPortCom.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    setTimeout(() => {
                        resolve();
                    }, 5000)

                });
            }
        });
    }

    async write(data) {
        return new Promise((resolve, reject) => {
            this.frames = [];
            this.serialPortCom.write(data);
            this.serialPortCom.drain(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
    }

    async sleep(delay) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, delay)
        });
    }

    async receiveBytes(){
        return new Promise(async (resolve, reject) => {
            for ( let i = 0 ; i < 100 ; i++ ){
                if ( this.frames.length > 0 ){
                    let __frame = [...this.frames[0]];
                    this.frames.splice(0,1);
                    resolve(__frame);
                    return;
                }
                await this.sleep(10);
            }
            reject("timeout");
        } );
    }


    async sendCommand(cmd, args = []) {
        try {
            //await this.serialPortCom.flush();
            let _buff = [0xA5, 0x40, cmd, 0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for (let i = 0; i < args.length; i++) {
                _buff[4 + i] = args[i];
            }
            let checksum = 0;
            for (let i = 0; i < _buff.length; i++) {
                checksum += _buff[i];
            }
            _buff[_buff.length - 1] = (checksum & 0xFF);
            await this.write(_buff);
        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = Protocol
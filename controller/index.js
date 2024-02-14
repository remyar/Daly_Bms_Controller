
const Protocol = require('./daly_protocol');

class Controller {
    constructor(settings) {

        this.interval = undefined;
        this.protocol = new Protocol(settings);

        this.packVoltage;
        this.packCurrent;
        this.packSOC;

        this.maxCellmV;
        this.maxCellVNum;
        this.minCellmV;
        this.maxCellVNum;
        this.cellDiff;

        this.tempMax;
        this.tempMin;
        this.tempAverage;

        this.chargeDischargeStatus;
        this.chargeFetState;
        this.disChargeFetState;
        this.bmsHeartBeat;
        this.resCapacitymAh;

        this.numberOfCells;
        this.numOfTempSensors;
        this.chargeState;
        this.loadState;
        this.dIO = [];
        this.bmsCycles;

        this.cellVmV = [];
        this.cellVminmV = [];
        this.cellVmaxmV = [];

        this.cellTemperature = [];

        this.cellBalanceState = [];

        this.cellBalanceActive = false;


    }

    async getPackMeasurements() {
        try {
            await this.protocol.sendCommand(this.protocol.VOUT_IOUT_SOC);
            let rxBuffer = await this.protocol.receiveBytes();

            this.packVoltage = ((rxBuffer[4] << 8) + rxBuffer[5]) / 10.0;
            this.packCurrent = (((rxBuffer[8] << 8) + rxBuffer[9]) - 30000) / 10.0;
            this.packSOC = ((rxBuffer[10] << 8) + rxBuffer[11]) / 10.0;

        } catch (err) {
            console.error(err);
        }
    }

    async getMinMaxCellVoltage() {
        try {
            await this.protocol.sendCommand(this.protocol.MIN_MAX_CELL_VOLTAGE);
            let rxBuffer = await this.protocol.receiveBytes();

            this.maxCellmV = ((rxBuffer[4] << 8) + rxBuffer[5]);
            this.maxCellVNum = rxBuffer[6]

            this.minCellmV = ((rxBuffer[7] << 8) + rxBuffer[8]);
            this.maxCellVNum = rxBuffer[9];

            this.cellDiff = this.maxCellmV - this.minCellmV;

        } catch (err) {
            console.error(err);
        }
    }

    async getPackTemp() {
        try {
            await this.protocol.sendCommand(this.protocol.MIN_MAX_TEMPERATURE);
            let rxBuffer = await this.protocol.receiveBytes();

            // An offset of 40 is added by the BMS to avoid having to deal with negative numbers, see protocol in /docs/
            this.tempMax = (rxBuffer[4] - 40);
            this.tempMin = (rxBuffer[6] - 40);
            this.tempAverage = (this.tempMax + this.tempMin) / 2;

        } catch (err) {
            console.error(err);
        }
    }

    async getDischargeChargeMosStatus() {
        try {
            await this.protocol.sendCommand(this.protocol.DISCHARGE_CHARGE_MOS_STATUS);
            let rxBuffer = await this.protocol.receiveBytes();

            this.chargeDischargeStatus = rxBuffer[4];
            this.chargeFetState = rxBuffer[5];
            this.disChargeFetState = rxBuffer[6];
            this.bmsHeartBeat = rxBuffer[7];
            this.resCapacitymAh = (rxBuffer[8] << 0x18) + (rxBuffer[9] << 0x10) + (rxBuffer[10] << 0x08) + rxBuffer[11];

        } catch (err) {
            console.error(err);
        }
    }

    async getStatusInfo() {
        try {
            await this.protocol.sendCommand(this.protocol.STATUS_INFO);
            let rxBuffer = await this.protocol.receiveBytes();

            this.numberOfCells = rxBuffer[4];
            this.numOfTempSensors = rxBuffer[5];
            this.chargeState = rxBuffer[6];
            this.loadState = rxBuffer[7];

            // Parse the 8 bits into 8 booleans that represent the states of the Digital IO
            let mask = 0x01;
            for (let i = 0; i < 8; i++) {
                this.dIO[i] = (rxBuffer[8] & mask) ? true : false;
                mask = mask << 1;
            }

            this.bmsCycles = (rxBuffer[9] << 0x08) + rxBuffer[10];


        } catch (err) {
            console.error(err);
        }
    }

    async getCellVoltages() {
        try {
            let cellNo = 0;
            await this.protocol.sendCommand(this.protocol.CELL_VOLTAGES);

            for (let i = 0; i <= Math.ceil(this.numberOfCells / 3); i++) {
                let rxBuffer = await this.protocol.receiveBytes();

                for (let j = 0; j < 3; j++) {
                    this.cellVmV[cellNo] = (rxBuffer[5 + j * 2] << 8) + rxBuffer[6 + j * 2];
                    cellNo++;
                    if (cellNo >= this.numberOfCells)
                        break;
                }
                if (cellNo >= this.numberOfCells)
                    break;
            }
        } catch (err) {
            console.error(err);
        }
    }

    async getCellTemperature() {
        try {
            let sensorNo = 0;
            await this.protocol.sendCommand(this.protocol.CELL_TEMPERATURE);
            for (let i = 0; i <= Math.ceil(this.numOfTempSensors / 7); i++) {
                let rxBuffer = await this.protocol.receiveBytes();
                for (let j = 0; j < 7; j++) {
                    this.cellTemperature[sensorNo] = (rxBuffer[5 + j] - 40);
                    sensorNo++;
                    if (sensorNo + 1 >= this.numOfTempSensors)
                        break;
                }
                if (sensorNo + 1 >= this.numOfTempSensors)
                    break;
            }
        } catch (err) {
            console.error(err);
        }
    }

    async getCellBalanceState() {
        try {
            let cellBit = 0;
            let cellBalance = 0;
            await this.protocol.sendCommand(this.protocol.CELL_BALANCE_STATE);
            let rxBuffer = await this.protocol.receiveBytes();

            // We expect 6 bytes response for this command
            for (let i = 0; i < 6; i++) {
                // For each bit in the byte, pull out the cell balance state boolean
                let mask = 0x01;
                for (let j = 0; j < 8; j++) {
                    this.cellBalanceState[cellBit] = (rxBuffer[i + 4] & mask) ? true : false;
                    mask = mask << 1;
                    if (this.cellBalanceState[cellBit] == true) {
                        cellBalance++;
                    }
                    cellBit++;
                    if (cellBit >= 47) {
                        break;
                    }
                }
                if (cellBit >= 47) {
                    break;
                }
            }

            if (cellBalance > 0) {
                this.cellBalanceActive = true;
            }
            else {
                this.cellBalanceActive = false;
            }

        } catch (err) {
            console.error(err);
        }
    }

    async connect() {
        try {
            await this.protocol.open();
            let flag = false;
            let state = 0;
            this.interval = setInterval(async () => {
                if (flag == false) {
                    flag = true;
                    try {
                        state == 0 ? await this.getPackMeasurements() : undefined;
                        state == 0 ? await this.getMinMaxCellVoltage() : undefined;
                        state == 0 ? await this.getPackTemp() : undefined;
                        state == 0 ? await this.getDischargeChargeMosStatus() : undefined;
                        state == 0 ? await this.getStatusInfo() : undefined;
                        state == 1 ? await this.getCellVoltages() : undefined;
                        state == 2 ? await this.getCellTemperature() : undefined;
                        state == 2 ? await this.getCellBalanceState() : undefined;
                        state++;
                        if (state >= 10) {
                            state = 0;
                        }
                    } catch (err) {
                        console.error(err);
                        await this.protocol.close();
                        await this.protocol.open();
                    }
                    flag = false;
                }
            }, 100);

        } catch (err) {
        }
    }

    async disconnect() {
        try {
            await this.protocol.close();

        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = Controller
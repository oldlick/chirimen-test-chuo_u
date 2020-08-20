var microBitBle;

var IrSens;
var TmpSens;

var loopEnable;
async function connect() {
  microBitBle = await microBitBleFactory.connect();
  msg.innerHTML = "BLE接続しました。";
  var gpioAccess = await microBitBle.requestGPIOAccess();
  var mbGpioPorts = gpioAccess.ports;
  IrSens = mbGpioPorts.get(1);
  await IrSens.export("in");
  var i2cAccess = await microBitBle.requestI2CAccess();
  var i2cPort = i2cAccess.ports.get(1);
  TmpSens = new ADT7410(i2cPort, 0x48);
  await TmpSens.init();
  loopEnable = true;
  loop();
}

async function disconnect() {
  loopEnable = false;
  await microBitBle.disconnect();
  msg.innerHTML = "BLE接続を切断しました。";
}
async function loop() {
  var IrSensVal, TmpSensVal;
  while (loopEnable) {
    IrSensVal = await IrSens.read();
    IrSensMsg.innerHTML = IrSensVal === 0 ? "OFF" : "ON";
    TmpSensVal = await TmpSens.read();
    TmpSensMsg.innerHTML = TmpSensVal;
    await sleep(100);
  }
}

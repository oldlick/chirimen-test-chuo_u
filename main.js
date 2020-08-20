var microBitBle;

var gpioPort1;

var blinkEnable;
async function connect() {
  microBitBle = await microBitBleFactory.connect();
  msg.innerHTML = "BLE接続しました。";
  var gpioAccess = await microBitBle.requestGPIOAccess();
  var mbGpioPorts = gpioAccess.ports;
  gpioPort1 = mbGpioPorts.get(1);
  await gpioPort1.export("in"); //port0 out
  blinkEnable = true;
  LEDblink();
}

async function disconnect() {
  blinkEnable = false;
  await microBitBle.disconnect();
  msg.innerHTML = "BLE接続を切断しました。";
}
async function LEDblink() {
  while (blinkEnable) {
    var gpio1Val = await gpioPort1.read();
    IrSensor.innerHTML = gpio1Val === 0 ? "OFF" : "ON";
    await sleep(100);
  }
}

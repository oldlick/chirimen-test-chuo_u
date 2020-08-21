var microBitBle;

var IrSens;
var TmpSens;
var ThermoSens;
var ThermoMax;
var ThermoMin;
var ThermoTableEnable = false;

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
  ThermoSens = new AMG8833(i2cPort, 0x69);
  await ThermoSens.init();
  if (ThermoTableEnable === false) {
    initTable();
    ThermoTableEnable = true;
  }
  await setAirTmp();
  await setAlarmTime();
  loopEnable = true;
  SensLoop();
  AlarmLoop();
}

async function disconnect() {
  loopEnable = false;
  await microBitBle.disconnect();
  msg.innerHTML = "BLE接続を切断しました。";
}

async function SensLoop() {
  var IrSensVal, TmpSensVal, ThermoSensImg, situation;
  while (loopEnable) {
    IrSensVal = await IrSens.read();
    IrSensMsg.innerHTML = IrSensVal === 0 ? "OFF" : "ON";
    TmpSensVal = await TmpSens.read();
    TmpSensMsg.innerHTML = TmpSensVal;
    ThermoSensImg = await ThermoSens.readData();
    heatMap(ThermoSensImg);
    console.log(ThermoSensImg);
    situation = await calcSituation(IrSensVal, ThermoSensImg);
    ExistenceHumanMsg.innerHTML = situation;
  }
}

var AirTmpVal;
var AlarmTimeVal;
async function AlarmLoop() {
  while (loopEnable) {
    var NowTimeVal = new Date();
    var d = AlarmTimeVal.getTime() - NowTimeVal.getTime();

    AlarmTimeMsgHour.innerHTML = Math.floor(d / 1000 / 60 / 60);
    d %= 1000 * 60 * 60;
    AlarmTimeMsgMinutes.innerHTML = Math.floor(d / 1000 / 60);
    await sleep(1000);
  }
}
async function setAirTmp() {
  AirTmpVal = Number(AirTmpTxt.value);
}
async function setAlarmTime() {
  AlarmTimeVal = new Date();
  var NowTimeVal = new Date();
  var h = Number(AlarmTimeTxtHour.value);
  var m = Number(AlarmTimeTxtMinutes.value);
  AlarmTimeVal.setHours(h);
  AlarmTimeVal.setMinutes(m);
  if (NowTimeVal.getTime() > AlarmTimeVal.getTime()) {
    AlarmTimeVal.setDate(AlarmTimeVal.getDate() + 1);
  }
}
async function calcSituation(IrSensVal, ThermoSensImg) {
  //0: 1:there is human 2:human is sleeping
  var cnt = 0;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      cnt += 30 < ThermoSensImg[i][j] && ThermoSensImg[i][j] < 36 ? 1 : 0;
    }
  }
  var box = document.getElementById("ExistenceHumanMBox");

  if (cnt > 1) {
    if (IrSensVal === 1) {
      box.style.backgroundColor = "#eeeeaa";
      return "exist";
    } else {
      box.style.backgroundColor = "#aaeeaa";
      return "sleep";
    }
  } else {
    box.style.backgroundColor = "#aaaaee";
    return "not exist";
  }
}

function initTable() {
  var table = document.getElementById("ThermoSensImg");
  for (var i = 0; i < 8; i++) {
    var tr = document.createElement("tr");
    for (var j = 0; j < 8; j++) {
      var td = document.createElement("td");
      td.id = "img" + j + "_" + i;
      td.innerText = "";
      td.style.backgroundColor = "#000000";
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function heatMap(tImage) {
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var tId = "img" + j + "_" + i;
      var td = document.getElementById(tId);
      var rgb = hsvToRgb(temperatureToHue(tImage[i][j]), 1, 1);
      var colorCode = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      td.style.backgroundColor = colorCode;
    }
  }
}

var tMax = 36;
var tMin = 15;
var hMax = 0;
var hMin = 270;
function temperatureToHue(temp) {
  if (temp > tMax) {
    return hMax;
  } else if (temp < tMin) {
    return hMin;
  } else {
    var ans = ((hMax - hMin) / (tMax - tMin)) * (temp - tMin) + hMin;
    return ans;
  }
}

function hsvToRgb(H, S, V) {
  var C = V * S;
  var Hp = H / 60;
  var X = C * (1 - Math.abs((Hp % 2) - 1));
  var R, G, B;
  if (0 <= Hp && Hp < 1) {
    [R, G, B] = [C, X, 0];
  }
  if (1 <= Hp && Hp < 2) {
    [R, G, B] = [X, C, 0];
  }
  if (2 <= Hp && Hp < 3) {
    [R, G, B] = [0, C, X];
  }
  if (3 <= Hp && Hp < 4) {
    [R, G, B] = [0, X, C];
  }
  if (4 <= Hp && Hp < 5) {
    [R, G, B] = [X, 0, C];
  }
  if (5 <= Hp && Hp < 6) {
    [R, G, B] = [C, 0, X];
  }
  var m = V - C;
  [R, G, B] = [R + m, G + m, B + m];

  R = Math.floor(R * 255);
  G = Math.floor(G * 255);
  B = Math.floor(B * 255);

  return [R, G, B];
}

var microBitBle;

var IrSens;
var TmpSens;
var ThermoSens;
var ThermoMax;
var ThermoMin;
var ws;
var OneTimeThingsEnable = false;

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
  if (OneTimeThingsEnable === false) {
    initTable();
    OneTimeThingsEnable = true;
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

var situation = "not exist";
var AirTmpVal;
var AirTmpSwitch = "off";
var AirTmpRadio;
var AlarmTimeVal;

async function SensLoop() {
  var IrSensVal, TmpSensVal, ThermoSensImg;
  while (loopEnable) {
    IrSensVal = await IrSens.read();
    IrSensMsg.innerHTML = IrSensVal === 0 ? "OFF" : "ON";
    TmpSensVal = await TmpSens.read();
    TmpSensMsg.innerHTML = TmpSensVal;
    checkAirTmp(TmpSensVal);
    ThermoSensImg = await ThermoSens.readData();
    heatMap(ThermoSensImg);
    console.log(ThermoSensImg);
    situation = await calcSituation(situation, IrSensVal, ThermoSensImg);
    ExistenceHumanMsg.innerHTML = situation;
    await sleep(500);
  }
}

async function AlarmLoop() {
  while (loopEnable) {
    var NowTimeVal = new Date();
    var d = AlarmTimeVal.getTime() - NowTimeVal.getTime();
    if (d < 0) {
      if (situation === "sleep") {
        AlarmTimeMsg.innerHTML = "起床時間です";
        changeLight(true);
      }
      setAlarmTime();
    } else {
      var hd = Math.floor(d / 1000 / 60 / 60);
      var hm = Math.floor(d / 1000 / 60) % 60;
      AlarmTimeMsg.innerHTML =
        hd + "h " + hm + "m 後にアラームが設定されています";
    }
    await sleep(1000);
  }
}

async function setAirTmp() {
  if (event.target.value === "upper") {
    AirTmpRadio = "upper";
    AirTmpUnderRadio.checked = false;
    AirTmpUpperRadio.checked = true;
  } else {
    AirTmpRadio = "under";
    AirTmpUnderRadio.checked = true;
    AirTmpUpperRadio.checked = false;
  }
  AirTmpVal = Number(AirTmpTxt.value);
}

async function setAlarmTime() {
  AlarmTimeVal = new Date();
  var NowTimeVal = new Date();
  var h = Number(AlarmTimeTxtHour.value) % 24;
  var m = Number(AlarmTimeTxtMinutes.value) % 60;
  AlarmTimeVal.setHours(h);
  AlarmTimeVal.setMinutes(m);
  if (NowTimeVal.getTime() >= AlarmTimeVal.getTime()) {
    AlarmTimeVal.setDate(AlarmTimeVal.getDate() + 1);
  }
}

async function calcSituation(oldSituation, IrSensVal, ThermoSensImg) {
  //0: 1:there is human 2:human is sleeping
  var cnt = 0;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      cnt += 29 < ThermoSensImg[i][j] && ThermoSensImg[i][j] < 36 ? 1 : 0;
    }
  }
  var box = document.getElementById("ExistenceHumanMBox");

  var newSituation;
  if (cnt > 1) {
    if (IrSensVal === 1) {
      box.style.backgroundColor = "#eeeeaa";
      newSituation = "exist";
    } else {
      box.style.backgroundColor = "#aaeeaa";
      newSituation = "sleep";
    }
  } else {
    box.style.backgroundColor = "#aaaaee";
    newSituation = "not exist";
  }
  if (oldSituation === "not exist") {
    if (newSituation === "not exist") return "not exist";
    else return "exist";
  } else if (oldSituation === "exist") {
    if (newSituation === "sleep") changeLight(false);
    return newSituation;
  } else if (oldSituation === "sleep") {
    if (newSituation === "not exist") {
      changeLight(true);
      return "not exist";
    } else return "sleep";
  }
  return "error";
}

async function checkAirTmp(TmpSensVal) {
  if (situation !== "sleep") {
    if (AirTmpSwitch === "on") {
      AirTmpSwitch = "off";
      changeAirTmp(false);
    }
  } else {
    //シュミットトリガ
    if (AirTmpRadio === "under") {
      if (AirTmpSwitch === "off" && TmpSensVal > AirTmpVal + 0.5) {
        AirTmpSwitch = "on";
        changeAirTmp(true);
      } else if (AirTmpSwitch === "on" && TmpSensVal < AirTmpVal - 0.5) {
        AirTmpSwitch = "off";
        changeAirTmp(false);
      }
    }
    if (AirTmpRadio === "upper") {
      if (AirTmpSwitch === "off" && TmpSensVal < AirTmpVal - 0.5) {
        AirTmpSwitch = "on";
        changeAirTmp(true);
      } else if (AirTmpSwitch === "on" && TmpSensVal > AirTmpVal + 0.5) {
        AirTmpSwitch = "off";
        changeAirTmp(false);
      }
    }
  }
  AirTmpMsg.innerHTML = "エアコン " + AirTmpSwitch;
}

async function changeAirTmp(on) {
  if (on) {
    ws = new WebSocket("ws://localhost:8080");
    ws.addEventListener("open", function (event) {
      console.log("WebSocket 接続完了");
      ws.send("air con on");
    });
  } else {
    ws = new WebSocket("ws://localhost:8080");
    ws.addEventListener("open", function (event) {
      console.log("WebSocket 接続完了");
      ws.send("air con off");
    });
  }
}

async function changeLight(on) {
  if (on) {
    ws = new WebSocket("ws://localhost:8080");
    ws.addEventListener("open", function (event) {
      console.log("WebSocket 接続完了");
      ws.send("light on");
    });
  } else {
    ws = new WebSocket("ws://localhost:8080");
    ws.addEventListener("open", function (event) {
      console.log("WebSocket 接続完了");
      ws.send("light off");
    });
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

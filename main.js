// main.js
// 組裝:開始按鈕(一次過綁定感測器/麥克風/AudioContext)、影片管理、
// 主迴圈(狀態機驅動視聽 + 參數映射)、除錯層與即時滑桿。

import { config } from './config.js';
import { MotionSensor, StateMachine, STATE } from './motion.js';
import { AudioEngine } from './audio.js';
import { VisualEngine } from './visual.js';

const startBtn = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const canvas = document.getElementById('view');
const errorBox = document.getElementById('errorBox');

let sensor, machine, audio, visual;
let videoEls = [];

// 平滑逼近用的當前值(朝目標 ease)
let trailMixCur = 0;
let shiftXCur = 0;
let mosaicCur = 1;      // 1 = 清晰
let mosaicTarget = config.mosaicMax; // STILL 起始為馬賽克

// ── 影片元素:每場景一個,muted+loop+playsinline ──
function buildVideos() {
  for (let i = 0; i < config.sceneCount; i++) {
    const v = document.createElement('video');
    v.src = config.videoPath(i + 1);
    v.muted = true;            // 靜音,聲音走 audio.js
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    videoEls.push(v);
  }
}

// 讓某支影片成為當前畫面來源(供 STILL 待機或 MOVING 播放)
function useVideo(sceneIndex, play) {
  const v = videoEls[sceneIndex];
  visual.setVideo(v);
  // 其他影片暫停以省資源
  videoEls.forEach((el, idx) => {
    if (idx !== sceneIndex) el.pause();
  });
  if (play) {
    v.play().catch(() => {});
  } else {
    // STILL 待機:載入並定位到開頭當馬賽克,不播放
    v.pause();
    v.currentTime = 0;
    // 觸發一次 load 以確保有可繪製的幀(readyState)
    if (v.readyState < 2) { try { v.load(); } catch (_) {} }
  }
}

async function begin() {
  try {
    startBtn.disabled = true;

    sensor = new MotionSensor();
    audio = new AudioEngine();
    visual = new VisualEngine(canvas);

    // 三件事全綁在這一次點擊手勢內
    await sensor.start();       // 感測器(含權限請求)
    await audio.start();        // AudioContext + 麥克風
    await visual.init();        // WebGL + shader 載入

    buildVideos();

    machine = new StateMachine(sensor);

    machine.onEnterMoving = (scene) => {
      useVideo(scene, true);
      audio.enterMoving(scene);
      mosaicTarget = 1;         // 清晰
    };
    machine.onEnterStill = (scene) => {
      useVideo(scene, false);   // 新抽的下一支,馬賽克待機
      audio.enterStill();
      mosaicTarget = config.mosaicMax;
    };

    // ── 冷啟動:起始為 STILL,手動設定待機狀態 ──
    useVideo(machine.currentScene, false);
    audio.enterStill();
    mosaicTarget = config.mosaicMax;

    startScreen.style.display = 'none';
    buildDebug();

    window.addEventListener('resize', () => visual.resize());
    requestAnimationFrame(loop);
  } catch (e) {
    startBtn.disabled = false;
    errorBox.style.display = 'block';
    errorBox.textContent = '啟動失敗:' + (e && e.message ? e.message : e) +
      '(需 HTTPS、允許麥克風與動作感測器權限)';
  }
}

// ── 主迴圈 ──
function loop() {
  const now = performance.now();

  machine.update(now);
  audio.update();

  // 參數映射:運動量 → 殘影;傾斜 → 橫向偏移;狀態 → 馬賽克
  const moving = machine.state === STATE.MOVING;

  // 殘影目標:運動時依運動量放大到 trailAmount 上限;靜止時歸零
  const motionNorm = Math.min(sensor.motion / (config.moveThreshold * 3), 1);
  const trailTarget = moving ? motionNorm * config.trailAmount : 0;
  trailMixCur += (trailTarget - trailMixCur) * config.trailEase;

  // 橫向偏移:傾斜映射到 normalized,乘上限(以像素換算成 uv)
  const shiftPxTarget = moving
    ? Math.max(-1, Math.min(1, sensor.tiltX / (config.moveThreshold * 2)))
      * config.trailShiftMax
    : 0;
  const shiftUvTarget = shiftPxTarget / (visual.W || 1);
  shiftXCur += (shiftUvTarget - shiftXCur) * config.trailEase;

  visual.setTrail(trailMixCur, shiftXCur);

  // 馬賽克:朝目標 ease
  mosaicCur += (mosaicTarget - mosaicCur) * config.mosaicEase;
  visual.setMosaic(mosaicCur);

  visual.render();

  if (debug.on) updateDebug();
  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────
// 除錯層 + 即時滑桿
// ─────────────────────────────────────────────
const debug = { on: config.debugDefaultOn, el: null, readout: null };

// 可即時調整的參數清單(min, max, step)
const SLIDERS = [
  ['moveThreshold', 0, 5, 0.05],
  ['motionSmoothing', 0.01, 1, 0.01],
  ['stillDelay', 0, 3000, 50],
  ['minMovingTime', 0, 8000, 100],
  ['mosaicMax', 1, 120, 1],
  ['mosaicEase', 0.005, 0.3, 0.005],
  ['trailAmount', 0, 0.98, 0.01],
  ['trailShiftMax', 0, 120, 1],
  ['trailEase', 0.01, 0.5, 0.01],
  ['audioFade', 0.005, 0.2, 0.005],
  ['micGainMax', 0, 2, 0.05],
  ['fileGainMax', 0, 2, 0.05],
];

function buildDebug() {
  const box = document.createElement('div');
  box.id = 'debug';
  box.style.cssText =
    'position:fixed;top:0;left:0;max-height:100vh;overflow:auto;' +
    'background:rgba(0,0,0,0.72);color:#0f0;font:11px/1.5 monospace;' +
    'padding:8px 10px;z-index:9999;width:230px;';

  const readout = document.createElement('div');
  readout.style.cssText = 'margin-bottom:8px;white-space:pre;color:#7fff7f;';
  box.appendChild(readout);
  debug.readout = readout;

  SLIDERS.forEach(([key, min, max, step]) => {
    const row = document.createElement('div');
    row.style.cssText = 'margin:3px 0;';
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;justify-content:space-between;';
    const name = document.createElement('span'); name.textContent = key;
    const val = document.createElement('span'); val.textContent = config[key];
    label.appendChild(name); label.appendChild(val);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min; slider.max = max; slider.step = step;
    slider.value = config[key];
    slider.style.cssText = 'width:100%;';
    slider.addEventListener('input', () => {
      config[key] = parseFloat(slider.value);
      val.textContent = config[key];
    });
    row.appendChild(label); row.appendChild(slider);
    box.appendChild(row);
  });

  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:8px;color:#888;';
  hint.textContent = '按 D 切換此面板 · 調好抄回 config.js';
  box.appendChild(hint);

  document.body.appendChild(box);
  debug.el = box;
  box.style.display = debug.on ? 'block' : 'none';

  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      debug.on = !debug.on;
      box.style.display = debug.on ? 'block' : 'none';
    }
  });
}

function updateDebug() {
  if (!debug.readout) return;
  debug.readout.textContent =
    `state    : ${machine.state}\n` +
    `motion   : ${sensor.motion.toFixed(3)}\n` +
    `tiltX    : ${sensor.tiltX.toFixed(3)}\n` +
    `scene    : ${machine.currentScene + 1}/${config.sceneCount}\n` +
    `trailMix : ${trailMixCur.toFixed(3)}\n` +
    `mosaic   : ${mosaicCur.toFixed(1)}`;
}

startBtn.addEventListener('click', begin);

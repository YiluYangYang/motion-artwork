// motion.js
// MotionSensor: 從 DeviceMotionEvent 取三軸加速度,去重力,算運動量與左右傾斜。
// StateMachine: MOVING / STILL 狀態轉換,含 stillDelay、minMovingTime 計時器與洗牌佇列。

import { config } from './config.js';

// ─────────────────────────────────────────────
// MotionSensor
// ─────────────────────────────────────────────
export class MotionSensor {
  constructor() {
    this.motion = 0;      // 平滑後的運動量 (去重力加速度 magnitude)
    this.tiltX = 0;       // 左右傾斜 (去重力後的 x 分量,帶正負號)
    this._gravity = { x: 0, y: 0, z: 0 };
    this._started = false;
    this._onDeviceMotion = this._onDeviceMotion.bind(this);
  }

  // 必須在使用者手勢(點「開始」)內呼叫
  async start() {
    if (this._started) return;

    const DME = window.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      const res = await DME.requestPermission();
      if (res !== 'granted') throw new Error('motion-permission-denied');
    }

    window.addEventListener('devicemotion', this._onDeviceMotion, true);
    this._started = true;
  }

  stop() {
    window.removeEventListener('devicemotion', this._onDeviceMotion, true);
    this._started = false;
  }

  _onDeviceMotion(e) {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (!a || a.x == null) return;

    const ax = a.x, ay = a.y, az = a.z;

    // 低通濾波估計重力(低頻分量)
    const k = 0.85;
    this._gravity.x = k * this._gravity.x + (1 - k) * ax;
    this._gravity.y = k * this._gravity.y + (1 - k) * ay;
    this._gravity.z = k * this._gravity.z + (1 - k) * az;

    // 扣除重力 → 線性加速度
    const lx = ax - this._gravity.x;
    const ly = ay - this._gravity.y;
    const lz = az - this._gravity.z;

    const magnitude = Math.sqrt(lx * lx + ly * ly + lz * lz);

    const s = config.motionSmoothing;
    this.motion = (1 - s) * this.motion + s * magnitude;
    this.tiltX = (1 - s) * this.tiltX + s * lx;
  }
}

// ─────────────────────────────────────────────
// ShuffleBag: 洗牌式不重複抽選
// ─────────────────────────────────────────────
class ShuffleBag {
  constructor(count) {
    this.count = count;
    this._bag = [];
    this._last = -1;
  }

  _refill() {
    this._bag = Array.from({ length: this.count }, (_, i) => i);
    for (let i = this._bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
    }
    if (this.count > 1 && this._bag[0] === this._last) {
      [this._bag[0], this._bag[1]] = [this._bag[1], this._bag[0]];
    }
  }

  next() {
    if (this._bag.length === 0) this._refill();
    const pick = this._bag.pop();
    this._last = pick;
    return pick;
  }
}

// ─────────────────────────────────────────────
// StateMachine
// ─────────────────────────────────────────────
export const STATE = { STILL: 'STILL', MOVING: 'MOVING' };

export class StateMachine {
  constructor(sensor) {
    this.sensor = sensor;
    this.state = STATE.STILL;
    this.bag = new ShuffleBag(config.sceneCount);
    this.currentScene = this.bag.next();

    this._belowSince = null;
    this._movingSince = null;

    this.onEnterMoving = () => {};
    this.onEnterStill = () => {};
  }

  update(now) {
    const m = this.sensor.motion;
    const moving = m > config.moveThreshold;

    if (this.state === STATE.STILL) {
      if (moving) {
        this.state = STATE.MOVING;
        this._movingSince = now;
        this._belowSince = null;
        this.onEnterMoving(this.currentScene);
      }
    } else { // MOVING
      if (!moving) {
        if (this._belowSince == null) this._belowSince = now;
        const stillEnough = now - this._belowSince >= config.stillDelay;
        const stayedLongEnough = now - this._movingSince >= config.minMovingTime;
        if (stillEnough && stayedLongEnough) {
          this.state = STATE.STILL;
          this._belowSince = null;
          this._movingSince = null;
          this.currentScene = this.bag.next();
          this.onEnterStill(this.currentScene);
        }
      } else {
        this._belowSince = null;
      }
    }
  }
}

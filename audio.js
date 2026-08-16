// audio.js
// AudioEngine: 麥克風即時現場音 ↔ 當前影片成對音檔,crossfade。

import { config } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.micGain = null;
    this.fileGain = null;
    this.micSource = null;

    this.audioEls = [];
    this.fileSource = null;
    this.currentEl = null;

    this._micTarget = config.micGainMax;
    this._fileTarget = 0;
    this._micValue = config.micGainMax;
    this._fileValue = 0;
  }

  async start() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    await this.ctx.resume();

    this.micGain = this.ctx.createGain();
    this.fileGain = this.ctx.createGain();
    this.micGain.gain.value = this._micValue;
    this.fileGain.gain.value = this._fileValue;
    this.micGain.connect(this.ctx.destination);
    this.fileGain.connect(this.ctx.destination);

    // 麥克風:關閉 AEC/降噪/自動增益,保留現場原始質感(戴耳機,無回授)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.micGain);

    for (let i = 0; i < config.sceneCount; i++) {
      const el = new Audio();
      el.src = config.audioPath(i + 1);
      el.loop = true;
      el.preload = 'none';
      el.crossOrigin = 'anonymous';
      this.audioEls.push(el);
    }
  }

  async enterMoving(sceneIndex) {
    const el = this.audioEls[sceneIndex];
    if (!el) return;

    if (this.fileSource) {
      try { this.fileSource.disconnect(); } catch (_) {}
      this.fileSource = null;
    }
    if (this.currentEl && this.currentEl !== el) {
      this.currentEl.pause();
      this.currentEl.currentTime = 0;
    }

    this.currentEl = el;
    if (!el._mesNode) {
      el._mesNode = this.ctx.createMediaElementSource(el);
    }
    this.fileSource = el._mesNode;
    this.fileSource.connect(this.fileGain);

    el.currentTime = 0;
    try { await el.play(); } catch (_) {}

    this._fileTarget = config.fileGainMax;
    this._micTarget = 0;
  }

  enterStill() {
    this._fileTarget = 0;
    this._micTarget = config.micGainMax;
  }

  update() {
    if (!this.ctx) return;
    const f = config.audioFade;

    this._micValue += (this._micTarget - this._micValue) * f;
    this._fileValue += (this._fileTarget - this._fileValue) * f;

    this.micGain.gain.value = this._micValue;
    this.fileGain.gain.value = this._fileValue;

    if (this._fileTarget === 0 && this._fileValue < 0.01 &&
        this.currentEl && !this.currentEl.paused) {
      this.currentEl.pause();
    }
  }
}

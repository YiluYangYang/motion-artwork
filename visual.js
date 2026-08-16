// visual.js
// WebGL 視覺管線:影片幀 → feedback(殘影,乒乓緩衝)→ pixelate(馬賽克)→ 螢幕。

import { config } from './config.js';

async function loadShaderSource(path) {
  const res = await fetch(path);
  return res.text();
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function makeProgram(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

export class VisualEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: false });
    if (!this.gl) throw new Error('WebGL 不支援');

    this.video = null;
    this.trailMix = 0;
    this.shiftX = 0;
    this.cellSize = 1;
    this._ready = false;
  }

  async init() {
    const gl = this.gl;
    const [feedbackFs, pixelateFs] = await Promise.all([
      loadShaderSource('shaders/feedback.glsl'),
      loadShaderSource('shaders/pixelate.glsl'),
    ]);

    this.progFeedback = makeProgram(gl, VERT, feedbackFs);
    this.progPixelate = makeProgram(gl, VERT, pixelateFs);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),
      gl.STATIC_DRAW);

    this.videoTex = this._createTex();
    this.fbo = [this._createFBO(), this._createFBO()];
    this.readIdx = 0;

    this.resize();
    this._ready = true;
  }

  _createTex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  _createFBO() {
    const gl = this.gl;
    const tex = this._createTex();
    const fb = gl.createFramebuffer();
    return { tex, fb };
  }

  _sizeFBO(o, w, h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, o.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, o.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, o.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.W = w; this.H = h;
    this._sizeFBO(this.fbo[0], w, h);
    this._sizeFBO(this.fbo[1], w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[0].fb);
    gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1].fb);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setVideo(el) { this.video = el; }
  setTrail(mix, shift) { this.trailMix = mix; this.shiftX = shift; }
  setMosaic(cellSize) { this.cellSize = cellSize; }

  _bindQuad(prog) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    if (!this._ready) return;
    const gl = this.gl;

    if (this.video && this.video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    }

    const read = this.fbo[this.readIdx];
    const write = this.fbo[1 - this.readIdx];

    // PASS 1: feedback → write fbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progFeedback);
    this._bindQuad(this.progFeedback);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
    gl.uniform1i(gl.getUniformLocation(this.progFeedback, 'uVideo'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, read.tex);
    gl.uniform1i(gl.getUniformLocation(this.progFeedback, 'uPrev'), 1);

    gl.uniform1f(gl.getUniformLocation(this.progFeedback, 'uTrailMix'), this.trailMix);
    gl.uniform1f(gl.getUniformLocation(this.progFeedback, 'uShiftX'), this.shiftX);
    gl.uniform2f(gl.getUniformLocation(this.progFeedback, 'uResolution'), this.W, this.H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // PASS 2: pixelate → 螢幕
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(this.progPixelate);
    this._bindQuad(this.progPixelate);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, write.tex);
    gl.uniform1i(gl.getUniformLocation(this.progPixelate, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.progPixelate, 'uCellSize'), this.cellSize);
    gl.uniform2f(gl.getUniformLocation(this.progPixelate, 'uResolution'), this.W, this.H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.readIdx = 1 - this.readIdx;
  }
}

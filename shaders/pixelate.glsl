// pixelate.glsl — 馬賽克 pass
precision mediump float;

uniform sampler2D uTex;       // feedback pass 輸出
uniform float uCellSize;      // 馬賽克格子大小 (px)
uniform vec2  uResolution;

varying vec2 vUv;

void main() {
  float cell = max(uCellSize, 1.0);
  vec2 px = vUv * uResolution;
  vec2 quantized = (floor(px / cell) + 0.5) * cell;
  vec2 uv = quantized / uResolution;
  gl_FragColor = texture2D(uTex, uv);
}

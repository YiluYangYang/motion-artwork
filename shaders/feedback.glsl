// feedback.glsl — 橫向殘影 pass
precision mediump float;

uniform sampler2D uVideo;    // 當前影片幀
uniform sampler2D uPrev;     // 上一幀累積結果
uniform float uTrailMix;     // 殘影混合比 0~1
uniform float uShiftX;       // 橫向偏移 (normalized)
uniform vec2  uResolution;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec4 current = texture2D(uVideo, uv);

  vec2 prevUv = uv + vec2(uShiftX, 0.0);
  vec4 prev = texture2D(uPrev, prevUv);
  if (prevUv.x < 0.0 || prevUv.x > 1.0) {
    prev = current;
  }

  vec3 col = mix(current.rgb, prev.rgb, uTrailMix);
  gl_FragColor = vec4(col, 1.0);
}

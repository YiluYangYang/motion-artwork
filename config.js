// config.js
// 所有可調參數集中處。預設值僅為起始點,現場以除錯層滑桿校準後抄回定案。

export const config = {
  // ── 場景素材 ──
  sceneCount: 3,                 // 影片/音檔組數,增減素材只改這裡
  videoPath: (n) =>              // 影片路徑規則(01-based,補零兩位)
    `assets/video_${String(n).padStart(2, '0')}.mp4`,
  audioPath: (n) =>              // 音檔路徑規則,與影片成對
    `assets/audio_${String(n).padStart(2, '0')}.mp3`,

  // ── 運動偵測 ──
  moveThreshold: 1.2,            // 去重力後加速度 magnitude 超過此值 → 判定運動 (m/s²)
  motionSmoothing: 0.2,          // 運動量低通濾波係數 (0~1,越小越平滑但越遲鈍)

  // ── 狀態機計時 ──
  stillDelay: 800,               // 運動量低於閾值持續多久 → 判定 STILL (ms)
  minMovingTime: 2500,           // 進入 MOVING 後最短停留時間 (ms)

  // ── 視覺:馬賽克 ──
  mosaicMax: 48,                 // STILL 時馬賽克最大格子大小 (px)
  mosaicEase: 0.04,              // 馬賽克強度逼近目標的速率 (0~1)

  // ── 視覺:殘影 ──
  trailAmount: 0.85,             // 殘影強度:上一幀保留比例上限 (0~1)
  trailShiftMax: 24,             // 左右傾斜造成的殘影最大橫向偏移 (px)
  trailEase: 0.15,               // 殘影參數逼近目標的速率

  // ── 聲音 ──
  audioFade: 0.03,               // mic ↔ 音檔 crossfade 速率 (每幀步進, 0~1)
  micGainMax: 1.0,               // 麥克風現場音最大音量
  fileGainMax: 1.0,              // 日常音檔最大音量

  // ── 除錯 ──
  debugDefaultOn: true,          // 載入時是否預設顯示除錯層 (正式展出設 false)
};

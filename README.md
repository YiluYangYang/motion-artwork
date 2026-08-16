# Motion Artwork — 測試與部署

單機、純前端。三軸加速度驅動:靜止=馬賽克畫面+麥克風現場音;移動=清晰影片+橫向殘影+日常音檔。

## 檔案結構
```
index.html      單頁,開始按鈕
main.js         組裝、主迴圈、除錯層
motion.js       運動偵測 + 狀態機
audio.js        麥克風 ↔ 音檔 crossfade
visual.js       WebGL 殘影 + 馬賽克
config.js       所有可調參數
shaders/        feedback.glsl(殘影)、pixelate.glsl(馬賽克)
assets/         video_01~03.mp4 + audio_01~03.mp3(你放素材)
```

## 放素材
見 assets/README.txt。成對命名,改 config.js 的 sceneCount 增減。

## 本機測試(重要)
不能直接雙擊開 index.html(shader 用 fetch 載入,file:// 會被 CORS 擋)。
必須用 local server:
```
cd motion-artwork
npx serve          # 或 python3 -m http.server
```
但本機是 http,Android Chrome 需要 HTTPS 才給麥克風+感測器。
所以真機測試最簡單的路徑是直接部署(見下)。

## 部署(拿免費 HTTPS)
把整個資料夾拖到 Netlify Drop(app.netlify.com/drop),或推到
GitHub 用 Pages,或 Vercel。得到 https 網址後用 Android Chrome 開。

## 現場校參數
- 開始後按 D 鍵切換除錯面板,直接拉滑桿即時調整
- 調到滿意後把數值抄回 config.js 定案
- 最需要現場校:moveThreshold(運動判定)、stillDelay / minMovingTime(節奏)、
  mosaicMax(靜止多糊)、trailAmount / trailShiftMax(殘影)、micGainMax(現場音量)

## 已知需真機驗證的點
1. 效能:1080p 影片 + 兩 pass + feedback,中低階機可能掉幀。
   先用 720p 素材測;若卡,降 config 裡不需要但可降 dpr(visual.js resize 的上限)。
2. 靜止過渡:殘影凝固與馬賽克糊化是兩段,需調 mosaicEase 與 trailEase 配順。
3. 現場音量:展場環境音響度不可預期,用 micGainMax 現場校平衡。
4. 感測器手勢:部分新版 Android Chrome 要求手勢後才給感測器,已綁在開始按鈕。
EOF
echo done
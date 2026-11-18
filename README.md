# 未來人生・進行曲

依 [MVP 企劃 v3](docs/MVP企劃_v3.md) 製作的純前端網頁遊戲。第 1 步包含標題、開局角色設定、自動與手動存檔，以及國中棋盤的暫時畫面。

## 開發與測試

需要 Node.js 22.12 以上。

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

GitHub Pages 會在更新 `main` 後自動建置及部署。正式網址為 [未來人生・進行曲](https://andyliu0817.github.io/virtual-life-web/)。

## 試玩

在手機上以直向開啟網頁，或在 MuMu 內以橫向開啟瀏覽器。從「開始新人生」建立角色，確認開局後便會自動儲存。回到標題並選「繼續遊戲」，可讀取自動存檔或手動存檔格。要在裝置之間移轉進度，可從棋盤匯出 JSON 檔，再在另一台裝置從標題匯入。

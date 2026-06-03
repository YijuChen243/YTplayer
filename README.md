# AeroPlay - Premium 無廣告 YouTube 播放器

AeroPlay 是一個設計優雅、無廣告干擾的 YouTube 音樂/影片播放器。它採用現代的 **毛玻璃設計風格 (Glassmorphism)** 與 **暗色調主題**，並搭配 **Firebase** 雲端資料庫，讓您在註冊/登入後，能夠隨時在不同設備上同步您喜愛的歌單。

---

## 🌟 特色功能

- **個人化雲端歌單**：使用電子郵件註冊/登入，每個人都擁有專屬的音樂收藏。
- **極致無廣告體驗**：利用官方 YouTube IFrame API 播放影片，去除網頁兩側與繁雜廣告，介面清爽。
- **精美客製控制面板**：整合播放/暫停、前一首、下一首、自訂進度條拖曳、音量調整與一鍵靜音。
- **自動續播功能**：播放結束時會自動為您跳至下一首播放，不中斷聆聽。
- **免修改程式碼設定**：內建「資料庫設定精靈」，可以直接在網頁上貼上您的 Firebase Config，儲存於瀏覽器 `localStorage` 中。

---

## 🛠️ Firebase 雲端資料庫設定指南

為了讓網頁能正常運作並儲存您的歌單，您需要建立一個免費的 Firebase 專案。請依照以下步驟操作：

### 1. 建立 Firebase 專案與 Web 應用程式
1. 前往 [Firebase 主控台](https://console.firebase.google.com/)，點擊 **「新增專案」**。
2. 建立完成後，在專案首頁點擊 **網頁圖示 (Web `</>`)** 以新增應用程式。
3. 替您的應用程式命名，點擊 **「註冊應用程式」**。
4. 註冊後，您會看到一組 `firebaseConfig` 的 JavaScript 物件，例如：
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-app-id.firebaseapp.com",
     "projectId": "your-app-id",
     "storageBucket": "your-app-id.appspot.com",
     "messagingSenderId": "1234567890",
     "appId": "1:123456:web:123456"
   }
   ```
   **請複製這段 JSON 物件備用。**

### 2. 啟用 Email 登入驗證 (Authentication)
1. 在 Firebase 左側選單中，點選 **Build > Authentication**。
2. 點擊 **Get Started**，在 **Sign-in method** 選擇 **「電子郵件/密碼 (Email/Password)」**。
3. 將其狀態啟用 (Enabled) 並儲存。

### 3. 建立 Firestore 資料庫 (Cloud Firestore)
1. 在 Firebase 左側選單中，點選 **Build > Firestore Database**。
2. 點擊 **Create database**，選擇適合您的伺服器地區。
3. 在安全性規則設定中，選擇「以測試模式啟動」或點擊建立。
4. **【重要】安全性規則設定**：
   為了確保每位使用者的歌單隱私，請切換到 Firestore 的 **Rules (規則)** 頁籤，將內容替換為以下安全性規則，然後點擊 **Publish (發布)**：

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /songs/{songId} {
         // 允許已驗證的使用者讀取、修改、刪除屬於自己的資料
         allow read, delete: if request.auth != null && resource.data.userId == request.auth.uid;
         // 允許已驗證的使用者建立屬於自己的資料
         allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

---

## 🚀 啟動並使用 AeroPlay

1. **在本機伺服器中開啟**：
   因為程式碼使用原生瀏覽器 ES 模組，直接雙擊 `index.html` 可能會因為 CORS 限制無法載入模組。您需要使用靜音的 Web 伺服器開啟它。
   - 如果您有安裝 `Node.js`，可以使用：
     ```bash
     npx serve
     ```
   - 如果您使用 `Python`，可以使用：
     ```bash
     python -m http.server 8080
     ```
   - 或者使用 VS Code 的 **Live Server** 擴充功能開啟。

2. **連結資料庫**：
   - 瀏覽器開啟網頁後，會看到「設定 Firebase 資料庫」畫面。
   - 點擊按鈕，並將剛剛備用的 **Firebase Config JSON 物件** 貼入輸入框中，點擊 **「儲存並連線」**。
   - 網頁重整後，即可進行帳號註冊與登入。

3. **新增首支影片/歌曲**：
   - 登入後，在右側輸入框貼上 YouTube 影片的完整網址 (例如：`https://www.youtube.com/watch?v=dQw4w9WgXcQ` 或短網址 `https://youtu.be/dQw4w9WgXcQ`)。
   - 點擊 `+` 按鈕，系統會自動擷取影片標題並加到您的主歌單！

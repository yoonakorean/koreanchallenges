import { loginWithGoogle, loginWithEmail, signUpWithEmail, logoutUser, initAuthListener } from "./services/auth.js";
import { saveUserData } from "./services/firebase.js";

let currentUser = null;
let currentUserData = null;

// 防錯 DOM 事件綁定
function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

document.addEventListener("DOMContentLoaded", () => {
  // 1. Google Gmail 快速連動登入
  safeAddListener("googleAuthBtn", "click", async () => {
    try {
      await loginWithGoogle();
      hideModal("authModal");
    } catch (err) {
      alert("Google 登入失敗：" + err.message);
    }
  });

  // 2. 程度切換選單邏輯 (完整支援 8 個級別驗證)
  safeAddListener("levelSelect", "change", (e) => {
    const selectedLevel = e.target.value;
    
    if (currentUserData && currentUserData.permissions) {
      if (!currentUserData.permissions.includes(selectedLevel)) {
        alert(`您的帳號尚未開通【${selectedLevel}】級別的閱讀權限！`);
        e.target.value = currentUserData.permissions[0] || "0A";
        return;
      }
    }
    
    console.log(`已切換學習程度至：${selectedLevel}`);
    // 自動載入該程度之單字/文法與語音模式 (維持原本邏輯)
  });

  // 3. 個人資料 - 語言選擇與設定儲存
  safeAddListener("saveProfileBtn", "click", async () => {
    if (!currentUser) return;
    const lang = document.getElementById("profileLanguageSelect").value;
    
    if (currentUserData) {
      currentUserData.language = lang;
      await saveUserData(currentUser.uid, currentUserData);
      alert("個人設定儲存成功！");
      hideModal("profileModal");
    }
  });

  // 4. Email 表單登入/註冊
  safeAddListener("authForm", "submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const pwd = document.getElementById("authPassword").value;
    try {
      await loginWithEmail(email, pwd);
      hideModal("authModal");
    } catch (err) {
      alert("登入失敗：" + err.message);
    }
  });

  safeAddListener("emailSignUpBtn", "click", async () => {
    const email = document.getElementById("authEmail").value;
    const pwd = document.getElementById("authPassword").value;
    if (!email || !pwd) return alert("請填寫 Email 與密碼");
    try {
      await signUpWithEmail(email, pwd);
      alert("註冊成功！");
      hideModal("authModal");
    } catch (err) {
      alert("註冊失敗：" + err.message);
    }
  });

  // 5. 登出
  safeAddListener("logoutBtn", "click", () => {
    logoutUser().then(() => alert("已成功登出"));
  });

  // 6. 身份驗證監聽與畫面更新
  initAuthListener((user, userData) => {
    currentUser = user;
    currentUserData = userData;

    const loginBtn = document.getElementById("loginBtn");
    const userInfo = document.getElementById("userInfo");
    const userDisplayName = document.getElementById("userDisplayName");
    const profileEmail = document.getElementById("profileEmail");
    const profileLangSelect = document.getElementById("profileLanguageSelect");

    if (user) {
      if (loginBtn) loginBtn.classList.add("d-none");
      if (userInfo) userInfo.classList.remove("d-none");
      if (userDisplayName) userDisplayName.textContent = user.displayName || user.email;
      if (profileEmail) profileEmail.value = user.email;
      if (profileLangSelect && userData) profileLangSelect.value = userData.language || "zh-TW";
      
      // 更新 8 個級別權限標籤顯示
      updatePermissionsUI(userData ? userData.permissions : ['0A']);
    } else {
      if (loginBtn) loginBtn.classList.remove("d-none");
      if (userInfo) userInfo.classList.add("d-none");
    }
  });
});

// 隱藏 Modal Helper
function hideModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
  }
}

// 8 個級別權限標籤顏色高亮
function updatePermissionsUI(permissions = []) {
  const levels = ["0A", "1A", "1B", "2A", "2B", "3A", "3B", "4A"];
  levels.forEach(lvl => {
    const badge = document.getElementById(`perm${lvl}`);
    if (badge) {
      if (permissions.includes(lvl)) {
        badge.className = "badge bg-success";
      } else {
        badge.className = "badge bg-secondary";
      }
    }
  });
}

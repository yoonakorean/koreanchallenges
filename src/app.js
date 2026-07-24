import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

let currentUser = null;
let isRegisterMode = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupAuthListeners();
    setupNavigationAndModals();
}

// 設置 DOM 事件安全綁定 (加強判斷，防止 null 報錯中斷網頁)
function safeAddEventListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    }
}

// 驗證狀態監聽與 UI 切換
function setupAuthListeners() {
    AuthService.onAuthStateChanged(async (user) => {
        const loginModal = document.getElementById('login-modal');
        const mainApp = document.getElementById('main-app');

        if (user) {
            try {
                const userData = await FirestoreService.getUserData(user.uid);
                currentUser = userData || { uid: user.uid, email: user.email, nickname: "學習者", xp: 0, loginDays: 0, currentLevel: "1A" };
                
                updateUserUI(currentUser);
                
                if (loginModal) loginModal.classList.add('hidden');
                if (mainApp) mainApp.classList.remove('hidden');
            } catch (err) {
                console.error("讀取使用者檔失敗:", err);
            }
        } else {
            currentUser = null;
            if (loginModal) loginModal.classList.remove('hidden');
            if (mainApp) mainApp.classList.add('hidden');
        }
    });
}

// 更新頂部資訊列
function updateUserUI(data) {
    const lblUsername = document.getElementById('lbl-username');
    const lblXp = document.getElementById('lbl-xp');
    const lblLoginDays = document.getElementById('lbl-login-days');
    const lblUserLevel = document.getElementById('lbl-user-level');

    if (lblUsername) lblUsername.textContent = data.nickname || "學生";
    if (lblXp) lblXp.textContent = data.xp || 0;
    if (lblLoginDays) lblLoginDays.textContent = data.loginDays || 0;
    if (lblUserLevel) lblUserLevel.textContent = data.currentLevel || "1A";
}

// 事件綁定與彈窗控制
function setupNavigationAndModals() {
    // 登入 / 註冊 頁籤切換
    safeAddEventListener('tab-login', 'click', () => {
        isRegisterMode = false;
        document.getElementById('tab-login')?.classList.add('active');
        document.getElementById('tab-register')?.classList.remove('active');
        document.getElementById('register-extended-fields')?.classList.add('hidden');
        const btnAuth = document.getElementById('btn-auth-submit');
        if (btnAuth) btnAuth.textContent = "進入挑戰";
    });

    safeAddEventListener('tab-register', 'click', () => {
        isRegisterMode = true;
        document.getElementById('tab-register')?.classList.add('active');
        document.getElementById('tab-login')?.classList.remove('active');
        document.getElementById('register-extended-fields')?.classList.remove('hidden');
        const btnAuth = document.getElementById('btn-auth-submit');
        if (btnAuth) btnAuth.textContent = "確認註冊";
    });

    // 送出 登入/註冊
    safeAddEventListener('btn-auth-submit', 'click', async () => {
        const email = document.getElementById('email-input')?.value.trim();
        const password = document.getElementById('password-input')?.value.trim();

        if (!email || !password) {
            alert("請輸入 Email 與密碼！");
            return;
        }

        try {
            if (isRegisterMode) {
                const nickname = document.getElementById('nickname-input')?.value.trim();
                const birthday = document.getElementById('birthday-input')?.value;
                
                if (!birthday) {
                    alert("請選擇出生年月日！");
                    return;
                }

                await AuthService.register(email, password, nickname, birthday);
                alert("註冊成功！歡迎加入！");
            } else {
                await AuthService.login(email, password);
            }
        } catch (error) {
            alert(error.message || "操作失敗，請重試！");
        }
    });

    // 程度切換彈窗控制
    safeAddEventListener('btn-level-trigger', 'click', () => {
        document.getElementById('modal-select-initial-level')?.classList.remove('hidden');
    });

    safeAddEventListener('btn-close-level-modal', 'click', () => {
        document.getElementById('modal-select-initial-level')?.classList.add('hidden');
    });

    safeAddEventListener('btn-confirm-initial-level', 'click', async () => {
        const select = document.getElementById('initial-level-select');
        if (select && currentUser) {
            currentUser.currentLevel = select.value;
            await FirestoreService.saveUserData(currentUser.uid, { currentLevel: select.value });
            updateUserUI(currentUser);
            document.getElementById('modal-select-initial-level')?.classList.add('hidden');
        }
    });

    // 鎖定提示彈窗
    safeAddEventListener('btn-close-locked-modal', 'click', () => {
        document.getElementById('modal-locked')?.classList.add('hidden');
    });

    // 課前暖身彈窗控制
    safeAddEventListener('btn-close-warmup-ask', 'click', () => {
        document.getElementById('modal-warmup-ask')?.classList.add('hidden');
    });
}

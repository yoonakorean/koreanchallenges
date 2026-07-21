import { STAGES } from './config/constants.js';
import { stageRegistry } from './core/stageRegistry.js';
import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

let authMode = 'login'; 

function loadRememberedCredentials() {
    const savedEmail = localStorage.getItem('saved_email');
    const savedPassword = localStorage.getItem('saved_password');
    const chkRemember = document.getElementById('chk-remember-me');

    if (savedEmail && savedPassword) {
        const emailInput = document.getElementById('email-input');
        const passwordInput = document.getElementById('password-input');
        if (emailInput) emailInput.value = savedEmail;
        if (passwordInput) passwordInput.value = savedPassword;
        if (chkRemember) chkRemember.checked = true;
    }
}

function handleRememberMe(email, password) {
    const chkRemember = document.getElementById('chk-remember-me');
    if (chkRemember && chkRemember.checked) {
        localStorage.setItem('saved_email', email);
        localStorage.setItem('saved_password', password);
    } else {
        localStorage.removeItem('saved_email');
        localStorage.removeItem('saved_password');
    }
}

function setupAuthEventListeners() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const registerFields = document.getElementById('register-extended-fields');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const btnLogout = document.getElementById('btn-logout');
    const loginModal = document.getElementById('login-modal');
    const mainApp = document.getElementById('main-app');

    loadRememberedCredentials();

    // 1. 切換至「登入」頁籤
    tabLogin?.addEventListener('click', () => {
        authMode = 'login';
        tabLogin.style.fontWeight = 'bold';
        tabLogin.style.borderBottom = '2px solid var(--primary)';
        tabRegister.style.fontWeight = 'normal';
        tabRegister.style.borderBottom = 'none';
        registerFields?.classList.add('hidden');
    });

    // 2. 切換至「註冊」頁籤
    tabRegister?.addEventListener('click', () => {
        authMode = 'register';
        tabRegister.style.fontWeight = 'bold';
        tabRegister.style.borderBottom = '2px solid var(--primary)';
        tabLogin.style.fontWeight = 'normal';
        tabLogin.style.borderBottom = 'none';
        registerFields?.classList.remove('hidden');
    });

    // 3. 送出登入 / 註冊
    btnSubmit?.addEventListener('click', async () => {
        const email = document.getElementById('email-input')?.value.trim();
        const password = document.getElementById('password-input')?.value.trim();

        if (!email || !password) {
            alert("請輸入電子信箱與密碼！");
            return;
        }

        try {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "驗證中...";

            if (authMode === 'login') {
                await AuthService.login(email, password);
            } else {
                await AuthService.register(email, password);
            }

            handleRememberMe(email, password);

        } catch (err) {
            alert(`驗證失敗: ${err.message}`);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "進入挑戰";
        }
    });

    // 4. 需求 3：點擊「登出」按鈕
    btnLogout?.addEventListener('click', async () => {
        if (confirm("確定要登出系統嗎？")) {
            await AuthService.logout();
        }
    });

    // 5. 監聽 Firebase Auth 登入狀態變更
    AuthService.onAuthStateChanged(async (user) => {
        if (user) {
            loginModal?.classList.add('hidden');
            mainApp?.classList.remove('hidden');

            const lblUsername = document.getElementById('lbl-username');
            if (lblUsername) lblUsername.innerText = user.email.split('@')[0];

            const userProgress = await FirestoreService.loadProgress(user.uid);
            console.log("已載入使用者進度:", userProgress);
        } else {
            loginModal?.classList.remove('hidden');
            mainApp?.classList.add('hidden');
        }
    });
}

function registerGameStages() {
    stageRegistry.register(STAGES.VOCAB, {
        generateQuestion: (data) => ({ type: STAGES.VOCAB, word: data.word, prompt: "請拼出這個單字" }),
        verify: (ans, target) => ans === target
    });
}

export function initApp() {
    console.log("🚀 遊戲系統初始化中...");
    registerGameStages();
    setupAuthEventListeners();
}

initApp();

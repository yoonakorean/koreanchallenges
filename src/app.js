import { STAGES } from './config/constants.js';
import { stageRegistry } from './core/stageRegistry.js';
import { QuestionGenerator } from './core/learningEngine.js';
import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

// 目前登入/註冊頁籤狀態 ('login' 或 'register')
let authMode = 'login'; 

/**
 * 載入預存的帳密（如果上次有勾選「記住我」）
 */
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

/**
 * 根據勾選狀態儲存或清除帳密
 */
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

/**
 * 綁定登入與頁籤事件
 */
function setupAuthEventListeners() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const registerFields = document.getElementById('register-extended-fields');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const loginModal = document.getElementById('login-modal');
    const mainApp = document.getElementById('main-app');

    // 嘗試帶入記憶的帳密
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

    // 3. 點擊「進入挑戰」按鈕送出表單
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
                console.log("登入成功！");
            } else {
                await AuthService.register(email, password);
                console.log("註冊成功！");
            }

            // 處理「記住我」功能
            handleRememberMe(email, password);

        } catch (err) {
            alert(`驗證失敗: ${err.message}`);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "進入挑戰";
        }
    });

    // 4. 監聽 Firebase Auth 登入狀態變更
    AuthService.onAuthStateChanged(async (user) => {
        if (user) {
            // 已登入：隱藏登入彈窗，顯示主遊戲畫面
            loginModal?.classList.add('hidden');
            mainApp?.classList.remove('hidden');

            // 顯示使用者名稱
            const lblUsername = document.getElementById('lbl-username');
            if (lblUsername) lblUsername.innerText = user.email.split('@')[0];

            // 讀取遊戲進度
            const userProgress = await FirestoreService.loadProgress(user.uid);
            console.log("已載入使用者進度:", userProgress);
        } else {
            // 未登入：顯示登入彈窗
            loginModal?.classList.remove('hidden');
            mainApp?.classList.add('hidden');
        }
    });
}

/**
 * 註冊各 Stage 處理器 (Phase 1 架構)
 */
function registerGameStages() {
    stageRegistry.register(STAGES.VOCAB, {
        generateQuestion: (data) => ({ type: STAGES.VOCAB, word: data.word, prompt: "請拼出這個單字" }),
        verify: (ans, target) => ans === target
    });

    stageRegistry.register(STAGES.SENTENCE, {
        generateQuestion: (data) => ({ type: STAGES.SENTENCE, sentence: data.sentence, prompt: "請完成句子重組" }),
        verify: (ans, target) => ans === target
    });

    stageRegistry.register(STAGES.SPEECH, {
        generateQuestion: (data) => ({ type: STAGES.SPEECH, targetSpeech: data.sentence, prompt: "請唸出句子" }),
        verify: (ans, target) => ans === target
    });
}

// 初始化應用程式
export function initApp() {
    console.log("🚀 遊戲系統初始化中...");
    registerGameStages();
    setupAuthEventListeners();
}

// 自動執行初始化
initApp();

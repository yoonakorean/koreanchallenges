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

/**
 * 🗺️ 地圖切換與關卡控制邏輯 (Step 1)
 */
function setupMapEventListeners() {
    const mapView = document.getElementById('map-view');
    const gameView = document.getElementById('game-view');
    const btnBackToMap = document.getElementById('btn-back-to-map');

    // 1. 監聽地圖上的所有關卡按鈕
    document.querySelectorAll('.stage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const unit = target.getAttribute('data-unit');
            const stage = target.getAttribute('data-stage');
            const isLocked = target.classList.contains('locked');

            if (isLocked) {
                // 點擊未解鎖關卡時彈出提示
                alert(`🔒 關卡鎖定中：需先通過單元 ${unit} 的階段 ${stage - 1} 才能挑戰喔！`);
            } else {
                // 進入開放關卡，切換至答題畫面
                console.log(`[Map Engine] 進入 單元 ${unit} - 階段 ${stage}`);
                
                // 更新答題頁面標題
                const lblUnitTitle = document.getElementById('lbl-current-unit-title');
                if (lblUnitTitle) lblUnitTitle.innerText = `單元 ${unit} - 階段 ${stage}`;

                // 畫面滑動切換
                mapView?.classList.add('hidden');
                gameView?.classList.remove('hidden');

                // [預留 Step 3/4]：此處將觸發課前暖身 Modal 或直奔 Stage 1 練習模式
            }
        });
    });

    // 2. 點擊「返回地圖」按鈕
    btnBackToMap?.addEventListener('click', () => {
        gameView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });
}

function setupAuthEventListeners() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const registerFields = document.getElementById('register-extended-fields');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const loginModal = document.getElementById('login-modal');
    const mainApp = document.getElementById('main-app');

    loadRememberedCredentials();

    tabLogin?.addEventListener('click', () => {
        authMode = 'login';
        tabLogin.style.fontWeight = 'bold';
        tabLogin.style.borderBottom = '2px solid var(--primary)';
        tabRegister.style.fontWeight = 'normal';
        tabRegister.style.borderBottom = 'none';
        registerFields?.classList.add('hidden');
    });

    tabRegister?.addEventListener('click', () => {
        authMode = 'register';
        tabRegister.style.fontWeight = 'bold';
        tabRegister.style.borderBottom = '2px solid var(--primary)';
        tabLogin.style.fontWeight = 'normal';
        tabLogin.style.borderBottom = 'none';
        registerFields?.classList.remove('hidden');
    });

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
    setupMapEventListeners();
}

initApp();

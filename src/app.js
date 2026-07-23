import { STAGES } from './config/constants.js';
import { stageRegistry } from './core/stageRegistry.js';
import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

let authMode = 'login'; 
let currentSelectedUnit = 1;
let currentSelectedStage = 1;

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
 * 🗺️ 視圖切換與彈窗互動控制 (Step 1)
 */
function setupNavigationAndModals() {
    const mapView = document.getElementById('map-view');
    const profileView = document.getElementById('profile-view');
    const gameView = document.getElementById('game-view');

    const modalLocked = document.getElementById('modal-locked');
    const modalWarmupAsk = document.getElementById('modal-warmup-ask');
    const modalLogoutConfirm = document.getElementById('modal-logout-confirm');

    // 1. 點擊學生姓名 ➔ 開啟 Profile 視圖 (問題 1 修正)
    document.getElementById('btn-profile-trigger')?.addEventListener('click', () => {
        mapView?.classList.add('hidden');
        gameView?.classList.add('hidden');
        profileView?.classList.remove('hidden');
    });

    // 2. Profile 頁面返回地圖
    document.getElementById('btn-profile-back-map')?.addEventListener('click', () => {
        profileView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

    // 3. 地圖關卡點擊事件
    document.querySelectorAll('.stage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            currentSelectedUnit = target.getAttribute('data-unit');
            currentSelectedStage = target.getAttribute('data-stage');
            const isLocked = target.classList.contains('locked');

            if (isLocked) {
                // 問題 4 修正：跳出美化鎖定 Modal
                modalLocked?.classList.remove('hidden');
            } else {
                // 問題 2 修正：點擊開放關卡時跳出「課前暖身 Modal」
                modalWarmupAsk?.classList.remove('hidden');
            }
        });
    });

    // 4. 關閉鎖定 Modal
    document.getElementById('btn-close-locked-modal')?.addEventListener('click', () => {
        modalLocked?.classList.add('hidden');
    });

    // 5. 課前暖身 Modal 按鈕回應
    document.getElementById('btn-warmup-yes')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        alert("將在 Step 2 為您開啟【單字學習卡 / 句型練習】頁面！");
    });

    document.getElementById('btn-warmup-no')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        // 直接進入挑戰
        const lblUnitTitle = document.getElementById('lbl-current-unit-title');
        if (lblUnitTitle) lblUnitTitle.innerText = `單元 ${currentSelectedUnit} - 階段 ${currentSelectedStage}`;

        mapView?.classList.add('hidden');
        gameView?.classList.remove('hidden');
    });

    // 6. 答題頁面返回地圖
    document.getElementById('btn-back-to-map')?.addEventListener('click', () => {
        gameView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

    // 7. Profile 頁面的登出按鈕 (問題 1 登出二次確認)
    document.getElementById('btn-trigger-logout')?.addEventListener('click', () => {
        modalLogoutConfirm?.classList.remove('hidden');
    });

    document.getElementById('btn-logout-no')?.addEventListener('click', () => {
        modalLogoutConfirm?.classList.add('hidden');
    });

    document.getElementById('btn-logout-yes')?.addEventListener('click', async () => {
        modalLogoutConfirm?.classList.add('hidden');
        await AuthService.logout();
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
        tabLogin.style.borderBottom = '2px solid #4f46e5';
        tabRegister.style.fontWeight = 'normal';
        tabRegister.style.borderBottom = 'none';
        registerFields?.classList.add('hidden');
    });

    tabRegister?.addEventListener('click', () => {
        authMode = 'register';
        tabRegister.style.fontWeight = 'bold';
        tabRegister.style.borderBottom = '2px solid #4f46e5';
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

            const username = user.email.split('@')[0];
            const lblUsername = document.getElementById('lbl-username');
            const profileNickname = document.getElementById('profile-nickname');
            const profileEmail = document.getElementById('profile-email');

            if (lblUsername) lblUsername.innerText = username;
            if (profileNickname) profileNickname.innerText = username;
            if (profileEmail) profileEmail.innerText = user.email;

            await FirestoreService.loadProgress(user.uid);
        } else {
            loginModal?.classList.remove('hidden');
            mainApp?.classList.add('hidden');
        }
    });
}

export function initApp() {
    console.log("🚀 遊戲系統初始化中...");
    setupAuthEventListeners();
    setupNavigationAndModals();
}

initApp();

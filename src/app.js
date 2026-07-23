import { STAGES } from './config/constants.js';
import { stageRegistry } from './core/stageRegistry.js';
import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

let authMode = 'login'; 
let currentCategory = 'korean';
let currentSelectedLevel = '1A';
let currentSelectedUnit = 1;
let currentSelectedStage = 1;

// 🌟 包含 Category ➔ Course ➔ Unit ➔ Lesson 固定必備單字庫 (requiredWords)
const MULTI_LANG_COURSES = {
    'korean': {
        '0A': [
            { 
                id: 1, title: '單元 1：母音 기초', 
                requiredWords: [
                    { wordId: 'k_001', word: '아', meaning: 'a', pos: '母音' },
                    { wordId: 'k_002', word: '오', meaning: 'o', pos: '母音' }
                ] 
            }
        ],
        '1A': [
            { 
                id: 1, title: '單元 1：有 / 沒有 (있다/없다)', 
                requiredWords: [
                    { wordId: 'k_101', word: '책', meaning: '書本', pos: '名詞', pron: '책', exampleKo: '책이 있어요.', exampleZh: '有書。' },
                    { wordId: 'k_102', word: '사과', meaning: '蘋果', pos: '名詞', pron: '사과', exampleKo: '사과가 없어요.', exampleZh: '沒有蘋果。' }
                ] 
            },
            { 
                id: 2, title: '單元 2：數量詞 (개/명)', 
                requiredWords: [
                    { wordId: 'k_103', word: '한 개', meaning: '一個', pos: '數量', pron: '한 개' }
                ] 
            }
        ]
    },
    'english': {
        '1A': [
            { 
                id: 1, title: 'Unit 1: Greeting & Be verb', 
                requiredWords: [
                    { wordId: 'e_101', word: 'Hello', meaning: '你好', pos: '感嘆詞' }
                ] 
            }
        ]
    },
    'japanese': {
        '1A': [
            { 
                id: 1, title: '單元 1：自我介紹 (입니다)', 
                requiredWords: [
                    { wordId: 'j_101', word: 'わたし', meaning: '我', pos: '代名詞' }
                ] 
            }
        ]
    }
};

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
 * 🗺️ 動態渲染學習地圖
 */
function renderMapUnits(category, level) {
    const container = document.getElementById('units-map-list');
    if (!container) return;

    const categoryData = MULTI_LANG_COURSES[category] || {};
    const units = categoryData[level] || [
        { id: 1, title: `單元 1：${category.toUpperCase()} ${level} 課程`, requiredWords: [] }
    ];

    container.innerHTML = units.map(unit => `
        <div class="unit-card">
            <div class="unit-header">
                <div class="unit-title"><i class="fa-solid fa-map-location-dot" style="color: var(--duo-blue);"></i> ${unit.title}</div>
            </div>
            <div class="stages-path">
                <button class="stage-btn-3d" data-unit="${unit.id}" data-stage="1"><i class="fa-solid fa-star"></i> 階段 1</button>
                <button class="stage-btn-3d locked" data-unit="${unit.id}" data-stage="2"><i class="fa-solid fa-lock"></i> 階段 2</button>
                <button class="stage-btn-3d locked" data-unit="${unit.id}" data-stage="3"><i class="fa-solid fa-lock"></i> 階段 3</button>
            </div>
        </div>
    `).join('');

    bindMapStageButtons();
}

function bindMapStageButtons() {
    const modalLocked = document.getElementById('modal-locked');
    const modalWarmupAsk = document.getElementById('modal-warmup-ask');

    document.querySelectorAll('.stage-btn-3d').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            currentSelectedUnit = target.getAttribute('data-unit');
            currentSelectedStage = target.getAttribute('data-stage');
            const isLocked = target.classList.contains('locked');

            if (isLocked) {
                modalLocked?.classList.remove('hidden');
            } else {
                modalWarmupAsk?.classList.remove('hidden');
            }
        });
    });
}

function setupNavigationAndModals() {
    const mapView = document.getElementById('map-view');
    const profileView = document.getElementById('profile-view');
    const gameView = document.getElementById('game-view');

    const modalLocked = document.getElementById('modal-locked');
    const modalWarmupAsk = document.getElementById('modal-warmup-ask');
    const modalLogoutConfirm = document.getElementById('modal-logout-confirm');

    // 類別選單切換 (韓語/英語/日語)
    document.getElementById('select-category')?.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        renderMapUnits(currentCategory, currentSelectedLevel);
    });

    // 程度選單切換
    document.getElementById('select-level-course')?.addEventListener('change', (e) => {
        currentSelectedLevel = e.target.value;
        renderMapUnits(currentCategory, currentSelectedLevel);
    });

    // 點擊姓名 ➔ Profile 視圖
    document.getElementById('btn-profile-trigger')?.addEventListener('click', () => {
        mapView?.classList.add('hidden');
        gameView?.classList.add('hidden');
        profileView?.classList.remove('hidden');
    });

    // Profile 返回地圖
    document.getElementById('btn-profile-back-map')?.addEventListener('click', () => {
        profileView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

    // 關閉鎖定 Modal
    document.getElementById('btn-close-locked-modal')?.addEventListener('click', () => {
        modalLocked?.classList.add('hidden');
    });

    // 課前暖身 Modal 按鈕
    document.getElementById('btn-warmup-yes')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        alert("將於 Step 2 開啟包含 [ requiredWords ] 的單字卡與句型練習頁面！");
    });

    document.getElementById('btn-warmup-no')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        const lblUnitTitle = document.getElementById('lbl-current-unit-title');
        if (lblUnitTitle) lblUnitTitle.innerText = `${currentCategory.toUpperCase()} - ${currentSelectedLevel} - 單元 ${currentSelectedUnit}`;

        mapView?.classList.add('hidden');
        gameView?.classList.remove('hidden');
    });

    // 答題頁面返回地圖
    document.getElementById('btn-back-to-map')?.addEventListener('click', () => {
        gameView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

    // 登出 Modal
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

    renderMapUnits(currentCategory, currentSelectedLevel);
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
        tabLogin.style.borderBottom = '2px solid var(--duo-blue)';
        tabRegister.style.fontWeight = 'normal';
        tabRegister.style.borderBottom = 'none';
        registerFields?.classList.add('hidden');
    });

    tabRegister?.addEventListener('click', () => {
        authMode = 'register';
        tabRegister.style.fontWeight = 'bold';
        tabRegister.style.borderBottom = '2px solid var(--duo-blue)';
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
    console.log("🚀 多語種遊戲學習系統初始化中...");
    setupAuthEventListeners();
    setupNavigationAndModals();
}

initApp();

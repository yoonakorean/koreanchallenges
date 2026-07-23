import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

let authMode = 'login'; 
let currentCategory = 'korean';
let currentSelectedLevel = '1A';
let currentSelectedUnit = 1;
let currentUserData = null;

const MULTI_LANG_COURSES = {
    'korean': {
        '0A': [{ id: 1, title: '單元 1：母音 기초', requiredWords: [] }],
        '1A': [
            { id: 1, title: '單元 1：有 / 沒有 (있다/없다)', requiredWords: [{ wordId: 'k_101', word: '책', meaning: '書本' }] },
            { id: 2, title: '單元 2：數量詞 (개/명)', requiredWords: [] }
        ],
        '1B': [{ id: 1, title: '單元 1：日常動詞與時態', requiredWords: [] }]
    }
};

function checkAndUpdateStreak(userData) {
    const today = new Date().toISOString().split('T')[0];
    let streak = userData.streak || 1;
    const lastLogin = userData.lastLoginDate || '';

    if (lastLogin) {
        const lastDate = new Date(lastLogin);
        const currentDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) streak += 1;
        else if (diffDays > 1) streak = 1;
    }

    return { streak, lastLoginDate: today };
}

function renderMapUnits(category, level) {
    const container = document.getElementById('units-map-list');
    if (!container) return;

    const categoryData = MULTI_LANG_COURSES[category] || {};
    const units = categoryData[level] || [
        { id: 1, title: `單元 1：${level} 基礎課程`, requiredWords: [] }
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
            const isLocked = target.classList.contains('locked');

            if (isLocked) {
                document.getElementById('lbl-locked-msg').innerText = "完成前面關卡才可以解鎖唷！";
                modalLocked?.classList.remove('hidden');
            } else {
                modalWarmupAsk?.classList.remove('hidden');
            }
        });
    });
}

function updateUIProfile(data) {
    currentUserData = data;
    
    // 頂部 Bar
    document.getElementById('lbl-username').innerText = data.nickname || '學生';
    document.getElementById('lbl-login-days').innerText = data.streak || 1;
    document.getElementById('lbl-user-level').innerText = data.allowedLevel || '1A';
    document.getElementById('lbl-energy').innerText = data.energy || 100;
    document.getElementById('lbl-xp').innerText = data.xp || 0;

    // 個人檔案頁面
    document.getElementById('profile-nickname').innerText = data.nickname || '學生';
    document.getElementById('profile-email').innerText = data.email || '';
    document.getElementById('profile-allowed-level').innerText = data.allowedLevel || '1A';
    document.getElementById('profile-expire-date').innerText = data.expireAt || '未定';
    document.getElementById('profile-energy').innerText = data.energy || 100;
    document.getElementById('profile-xp').innerText = data.xp || 0;
    document.getElementById('profile-streak').innerText = data.streak || 1;

    const levelSelect = document.getElementById('select-level-course');
    if (levelSelect) levelSelect.value = data.allowedLevel || '1A';
}

function setupNavigationAndModals() {
    const mapView = document.getElementById('map-view');
    const profileView = document.getElementById('profile-view');
    const gameView = document.getElementById('game-view');

    const modalLocked = document.getElementById('modal-locked');
    const modalWarmupAsk = document.getElementById('modal-warmup-ask');
    const modalLogoutConfirm = document.getElementById('modal-logout-confirm');

    // 🔒 程度切換檢查
    document.getElementById('select-level-course')?.addEventListener('change', (e) => {
        const selected = e.target.value;
        const allowed = currentUserData?.allowedLevel || '1A';

        if (selected > allowed) {
            document.getElementById('lbl-locked-msg').innerText = `您的帳號目前權限為 ${allowed}，無法存取 ${selected} 程度。如需開通請聯繫後台管理員！`;
            modalLocked?.classList.remove('hidden');
            e.target.value = currentSelectedLevel;
        } else {
            currentSelectedLevel = selected;
            renderMapUnits(currentCategory, currentSelectedLevel);
        }
    });

    // 🌟 4. 修復同程度總榜與好友榜 Tab 切換
    const tabFriends = document.getElementById('tab-leaderboard-friends');
    const tabGlobal = document.getElementById('tab-leaderboard-global');
    const contentFriends = document.getElementById('content-rank-friends');
    const contentGlobal = document.getElementById('content-rank-global');

    tabFriends?.addEventListener('click', () => {
        tabFriends.classList.add('active');
        tabGlobal.classList.remove('active');
        contentFriends?.classList.remove('hidden');
        contentGlobal?.classList.add('hidden');
    });

    tabGlobal?.addEventListener('click', () => {
        tabGlobal.classList.add('active');
        tabFriends.classList.remove('active');
        contentGlobal?.classList.remove('hidden');
        contentFriends?.classList.add('hidden');
    });

    // 🌟 4. 修復點擊修改暱稱按鈕
    const modalEditNickname = document.getElementById('modal-edit-nickname');
    document.getElementById('btn-open-edit-nickname')?.addEventListener('click', () => {
        const lastChange = currentUserData?.lastNicknameChange;
        if (lastChange) {
            const lastDate = new Date(lastChange);
            const now = new Date();
            const diffDays = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
            if (diffDays < 365) {
                alert(`一年內僅能修改一次暱稱！距離下次可修改還有 ${365 - diffDays} 天。`);
                return;
            }
        }
        modalEditNickname?.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-nickname')?.addEventListener('click', () => {
        modalEditNickname?.classList.add('hidden');
    });

    document.getElementById('btn-save-nickname')?.addEventListener('click', async () => {
        const newNick = document.getElementById('input-new-nickname')?.value.trim();
        if (!newNick) return alert("請輸入有效暱稱！");

        const today = new Date().toISOString().split('T')[0];
        await FirestoreService.updateUserData(currentUserData.uid, {
            nickname: newNick,
            lastNicknameChange: today
        });

        currentUserData.nickname = newNick;
        currentUserData.lastNicknameChange = today;
        updateUIProfile(currentUserData);
        modalEditNickname?.classList.add('hidden');
        alert("暱稱修改成功！");
    });

    // 🌟 4. 修復點擊修改密碼按鈕
    const modalChangePassword = document.getElementById('modal-change-password');
    document.getElementById('btn-open-change-password')?.addEventListener('click', () => {
        modalChangePassword?.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-password')?.addEventListener('click', () => {
        modalChangePassword?.classList.add('hidden');
    });

    document.getElementById('btn-save-password')?.addEventListener('click', async () => {
        const newPass = document.getElementById('input-new-password')?.value.trim();
        if (!newPass || newPass.length < 6) return alert("密碼至少需為 6 位數！");

        try {
            await AuthService.updatePassword(newPass);
            alert("密碼修改成功！下次登入請使用新密碼。");
            modalChangePassword?.classList.add('hidden');
        } catch (err) {
            alert(`修改密碼失敗: ${err.message}`);
        }
    });

    // 🌟 3. 新增好友彈窗事件
    const modalAddFriend = document.getElementById('modal-add-friend');
    document.getElementById('btn-open-add-friend')?.addEventListener('click', () => {
        modalAddFriend?.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-add-friend')?.addEventListener('click', () => {
        modalAddFriend?.classList.add('hidden');
    });

    document.getElementById('btn-submit-add-friend')?.addEventListener('click', () => {
        const friendInput = document.getElementById('input-friend-id')?.value.trim();
        if (!friendInput) return alert("請輸入好友的帳號或暱稱！");
        alert(`已成功發送好友邀請給 [${friendInput}]！等待對方確認。`);
        modalAddFriend?.classList.add('hidden');
    });

    // 視圖導覽
    document.getElementById('btn-profile-trigger')?.addEventListener('click', () => {
        mapView?.classList.add('hidden');
        gameView?.classList.add('hidden');
        profileView?.classList.remove('hidden');
    });

    document.getElementById('btn-profile-back-map')?.addEventListener('click', () => {
        profileView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

    document.getElementById('btn-close-locked-modal')?.addEventListener('click', () => {
        modalLocked?.classList.add('hidden');
    });

    document.getElementById('btn-warmup-yes')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        alert("即將進入 Step 2 課前暖身頁面！");
    });

    document.getElementById('btn-warmup-no')?.addEventListener('click', () => {
        modalWarmupAsk?.classList.add('hidden');
        mapView?.classList.add('hidden');
        gameView?.classList.remove('hidden');
    });

    document.getElementById('btn-back-to-map')?.addEventListener('click', () => {
        gameView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    });

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

    tabLogin?.addEventListener('click', () => {
        authMode = 'login';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        registerFields?.classList.add('hidden');
    });

    tabRegister?.addEventListener('click', () => {
        authMode = 'register';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerFields?.classList.remove('hidden');
    });

    btnSubmit?.addEventListener('click', async () => {
        const email = document.getElementById('email-input')?.value.trim();
        const password = document.getElementById('password-input')?.value.trim();

        if (!email || !password) return alert("請輸入電子信箱與密碼！");

        try {
            btnSubmit.disabled = true;
            if (authMode === 'login') {
                await AuthService.login(email, password);
            } else {
                const nickname = document.getElementById('nickname-input')?.value.trim();
                if (!nickname) return alert("請輸入暱稱！");
                await AuthService.register(email, password, { nickname });
            }
        } catch (err) {
            alert(`驗證失敗: ${err.message}`);
        } finally {
            btnSubmit.disabled = false;
        }
    });

    AuthService.onAuthStateChanged(async (user) => {
        if (user) {
            loginModal?.classList.add('hidden');

            let userData = await FirestoreService.getUserData(user.uid);

            const today = new Date().toISOString().split('T')[0];
            if (userData && userData.expireAt && userData.expireAt < today) {
                alert("您的帳號使用期限已到期！學習紀錄已保存，請聯繫後台管理員重新開通。");
                await AuthService.logout();
                return;
            }

            if (!userData || !userData.allowedLevel) {
                document.getElementById('modal-select-initial-level')?.classList.remove('hidden');
                
                document.getElementById('btn-confirm-initial-level').onclick = async () => {
                    const selectedLevel = document.getElementById('initial-level-select').value;
                    const streakData = checkAndUpdateStreak(userData || {});
                    
                    const newUserData = {
                        uid: user.uid,
                        email: user.email,
                        nickname: userData?.nickname || user.email.split('@')[0],
                        allowedLevel: selectedLevel,
                        xp: 0,
                        energy: 100,
                        expireAt: '2026-12-31',
                        ...streakData
                    };

                    await FirestoreService.saveUserData(user.uid, newUserData);
                    document.getElementById('modal-select-initial-level')?.classList.add('hidden');
                    
                    mainApp?.classList.remove('hidden');
                    updateUIProfile(newUserData);
                    renderMapUnits(currentCategory, selectedLevel);
                };
            } else {
                const streakData = checkAndUpdateStreak(userData);
                await FirestoreService.updateUserData(user.uid, streakData);
                userData = { ...userData, ...streakData };

                mainApp?.classList.remove('hidden');
                currentSelectedLevel = userData.allowedLevel;
                updateUIProfile(userData);
                renderMapUnits(currentCategory, currentSelectedLevel);
            }

        } else {
            loginModal?.classList.remove('hidden');
            mainApp?.classList.add('hidden');
        }
    });
}

export function initApp() {
    setupAuthEventListeners();
    setupNavigationAndModals();
}

initApp();

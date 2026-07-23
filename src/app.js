import { AuthService } from './services/auth.js';
import { FirestoreService } from './services/firebase.js';

// 💡 請在此處貼上您部署獲得的 GAS Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzcpVJShHN94x3-igocTch4A9nsvwgBvIc_Qe-yCFhwFKTkQm97TMkysZqalBVQaf_M/exec";

let authMode = 'login'; 
let currentCategory = 'korean';
let currentSelectedLevel = '1A';
let currentSelectedUnit = 1;
let currentUserData = null;

let viewYear = 2026;
let viewMonth = 6; 

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

// 向 Google 試算表 API 查驗白名單權限
async function fetchWhitelistData(email) {
    if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
        console.warn("尚未設定有效的 GAS_WEB_APP_URL，預設載入 1A 權限。");
        return { allowedLevels: ['1A', '1B'], expireAt: '2026-12-31', active: true };
    }

    try {
        const response = await fetch(`${GAS_WEB_APP_URL}?email=${encodeURIComponent(email)}`);
        const result = await response.json();
        if (result.status === "success") {
            return result;
        }
    } catch (error) {
        console.error("讀取試算表白名單失敗:", error);
    }
    return null;
}

function checkAndUpdateStreak(userData) {
    const today = new Date().toISOString().split('T')[0];
    let streak = userData.streak || 1;
    const lastLogin = userData.lastLoginDate || '';
    let loginHistory = userData.loginHistory || [];

    if (!loginHistory.includes(today)) {
        loginHistory.push(today);
    }

    if (lastLogin) {
        const lastDate = new Date(lastLogin);
        const currentDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) streak += 1;
        else if (diffDays > 1) streak = 1;
    }

    return { streak, lastLoginDate: today, loginHistory };
}

function renderStreakCalendar(loginHistory = [], year = viewYear, month = viewMonth) {
    const container = document.getElementById('calendar-days-container');
    const monthTitle = document.getElementById('lbl-calendar-month-title');
    if (!container) return;

    if (monthTitle) {
        monthTitle.innerText = `${year}年 ${month + 1}月`;
    }

    container.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day';
        container.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.innerText = day;

        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        if (loginHistory.includes(dateKey)) {
            dayCell.classList.add('active-login');
        }

        container.appendChild(dayCell);
    }
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
        btn.onclick = (e) => {
            const target = e.currentTarget;
            currentSelectedUnit = target.getAttribute('data-unit');
            const isLocked = target.classList.contains('locked');

            if (isLocked) {
                document.getElementById('lbl-locked-msg').innerText = "完成前面關卡才可以解鎖唷！";
                modalLocked?.classList.remove('hidden');
            } else {
                modalWarmupAsk?.classList.remove('hidden');
            }
        };
    });
}

// 渲染好友邀請與好友列表 (含刪除按鈕)
function renderFriendsUI(data) {
    const requestsBox = document.getElementById('box-friend-requests');
    const requestsList = document.getElementById('list-friend-requests');
    const friendsList = document.getElementById('list-my-friends');
    const unreadDot = document.getElementById('dot-unread-invite');

    const incomingRequests = data.friendRequests || [];
    const friends = data.friends || [];

    // 處理待接受邀請
    if (incomingRequests.length > 0) {
        requestsBox?.classList.remove('hidden');
        unreadDot?.classList.remove('hidden');
        if (requestsList) {
            requestsList.innerHTML = incomingRequests.map(req => `
                <div class="friend-item-card">
                    <div style="text-align: left;">
                        <strong style="font-size: 0.9rem; color: #1f2937;">${req.nickname || '學員'}</strong>
                        <div style="font-size: 0.75rem; color: #6b7280;">${req.email}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-3d btn-3d-primary btn-accept-friend" data-email="${req.email}" style="padding: 4px 10px; font-size: 0.8rem !important;">接受</button>
                        <button class="btn-3d btn-3d-secondary btn-reject-friend" data-email="${req.email}" style="padding: 4px 10px; font-size: 0.8rem !important;">拒絕</button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        requestsBox?.classList.add('hidden');
        unreadDot?.classList.add('hidden');
    }

    // 渲染已有好友列表 (支援刪除好友)
    if (friendsList) {
        if (friends.length === 0) {
            friendsList.innerHTML = `<p style="font-size: 0.9rem; color: #6b7280; text-align: center; margin-bottom: 12px;">尚未新增任何好友</p>`;
        } else {
            friendsList.innerHTML = friends.map(f => `
                <div class="friend-item-card">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-circle-user" style="font-size: 1.8rem; color: var(--duo-blue);"></i>
                        <div style="text-align: left;">
                            <div style="font-size: 0.9rem; font-weight: bold; color: #1f2937;">${f.nickname}</div>
                            <div style="font-size: 0.75rem; color: var(--duo-gold);"><i class="fa-solid fa-star"></i> ${f.xp || 0} XP</div>
                        </div>
                    </div>
                    <button class="btn-3d btn-remove-friend" data-email="${f.email}" style="padding: 4px 8px; font-size: 0.75rem !important; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5;">
                        <i class="fa-solid fa-user-minus"></i> 刪除
                    </button>
                </div>
            `).join('');
        }
    }

    bindFriendActions();
}

function bindFriendActions() {
    // 接受邀請
    document.querySelectorAll('.btn-accept-friend').forEach(btn => {
        btn.onclick = async (e) => {
            const targetEmail = e.currentTarget.getAttribute('data-email');
            const req = currentUserData.friendRequests.find(r => r.email === targetEmail);
            
            currentUserData.friendRequests = currentUserData.friendRequests.filter(r => r.email !== targetEmail);
            currentUserData.friends = currentUserData.friends || [];
            currentUserData.friends.push(req);

            await FirestoreService.updateUserData(currentUserData.uid, {
                friendRequests: currentUserData.friendRequests,
                friends: currentUserData.friends
            });

            renderFriendsUI(currentUserData);
            alert(`已接受 [${req.nickname}] 的好友邀請！`);
        };
    });

    // 拒絕邀請
    document.querySelectorAll('.btn-reject-friend').forEach(btn => {
        btn.onclick = async (e) => {
            const targetEmail = e.currentTarget.getAttribute('data-email');
            currentUserData.friendRequests = currentUserData.friendRequests.filter(r => r.email !== targetEmail);

            await FirestoreService.updateUserData(currentUserData.uid, {
                friendRequests: currentUserData.friendRequests
            });

            renderFriendsUI(currentUserData);
        };
    });

    // 刪除好友
    document.querySelectorAll('.btn-remove-friend').forEach(btn => {
        btn.onclick = async (e) => {
            const targetEmail = e.currentTarget.getAttribute('data-email');
            if (confirm(`確定要將 [${targetEmail}] 從好友名單中移除嗎？`)) {
                currentUserData.friends = currentUserData.friends.filter(f => f.email !== targetEmail);
                
                await FirestoreService.updateUserData(currentUserData.uid, {
                    friends: currentUserData.friends
                });

                renderFriendsUI(currentUserData);
                alert("已成功移除該好友！");
            }
        };
    });
}

function updateUIProfile(data) {
    currentUserData = data;
    const allowedLevels = Array.isArray(data.allowedLevels) ? data.allowedLevels : [data.allowedLevel || '1A'];

    // 頂部 Bar
    document.getElementById('lbl-username').innerText = data.nickname || '學生';
    document.getElementById('lbl-login-days').innerText = data.streak || 1;
    document.getElementById('lbl-user-level').innerText = currentSelectedLevel;
    document.getElementById('lbl-energy').innerText = data.energy || 100;
    document.getElementById('lbl-xp').innerText = data.xp || 0;

    // 個人檔案頁面
    document.getElementById('profile-nickname').innerText = data.nickname || '學生';
    document.getElementById('profile-email').innerText = data.email || '';
    document.getElementById('profile-allowed-level').innerText = allowedLevels.join(', ');
    document.getElementById('profile-expire-date').innerText = data.expireAt || '未定';
    document.getElementById('profile-energy').innerText = data.energy || 100;
    document.getElementById('profile-xp').innerText = data.xp || 0;
    document.getElementById('profile-streak').innerText = data.streak || 1;

    // 打卡儀表板
    document.getElementById('dash-streak-days').innerText = data.streak || 1;
    document.getElementById('dash-focus-hours').innerText = (data.focusHours || 0.0).toFixed(1);

    // 填充選單
    const levelSelect = document.getElementById('initial-level-select');
    if (levelSelect) {
        levelSelect.innerHTML = allowedLevels.map(lvl => `<option value="${lvl}">${lvl} 程度課程</option>`).join('');
    }

    renderFriendsUI(data);
}

function setupNavigationAndModals() {
    const mapView = document.getElementById('map-view');
    const profileView = document.getElementById('profile-view');
    const gameView = document.getElementById('game-view');

    const modalLocked = document.getElementById('modal-locked');
    const modalWarmupAsk = document.getElementById('modal-warmup-ask');
    const modalStreakDashboard = document.getElementById('modal-streak-dashboard');
    const modalLogoutConfirm = document.getElementById('modal-logout-confirm');
    const modalLevelSelect = document.getElementById('modal-select-initial-level');

    // 打卡儀表板
    const streakBtn = document.getElementById('btn-streak-trigger');
    if (streakBtn) {
        streakBtn.onclick = () => {
            const now = new Date();
            viewYear = now.getFullYear();
            viewMonth = now.getMonth();
            renderStreakCalendar(currentUserData?.loginHistory || [], viewYear, viewMonth);
            modalStreakDashboard?.classList.remove('hidden');
        };
    }

    document.getElementById('btn-close-streak-modal').onclick = () => {
        modalStreakDashboard?.classList.add('hidden');
    };

    document.getElementById('btn-cal-prev').onclick = () => {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderStreakCalendar(currentUserData?.loginHistory || [], viewYear, viewMonth);
    };

    document.getElementById('btn-cal-next').onclick = () => {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderStreakCalendar(currentUserData?.loginHistory || [], viewYear, viewMonth);
    };

    // 程度切換
    const levelTrigger = document.getElementById('btn-level-trigger');
    if (levelTrigger) {
        levelTrigger.onclick = () => {
            const select = document.getElementById('initial-level-select');
            if (select) select.value = currentSelectedLevel;
            modalLevelSelect?.classList.remove('hidden');
        };
    }

    document.getElementById('btn-close-level-modal').onclick = () => {
        modalLevelSelect?.classList.add('hidden');
    };

    document.getElementById('btn-confirm-initial-level').onclick = () => {
        const selected = document.getElementById('initial-level-select').value;
        currentSelectedLevel = selected;
        renderMapUnits(currentCategory, currentSelectedLevel);
        document.getElementById('lbl-user-level').innerText = selected;
        modalLevelSelect?.classList.add('hidden');
    };

    // 頁籤切換
    const btnProfileTrigger = document.getElementById('btn-profile-trigger');
    const subPageLeaderboard = document.getElementById('sub-page-leaderboard');
    const subPageProfile = document.getElementById('sub-page-profile');
    const btnViewLeaderboard = document.getElementById('btn-view-leaderboard');
    const btnViewProfile = document.getElementById('btn-view-profile');

    function switchSubPage(target) {
        if (target === 'leaderboard') {
            btnViewLeaderboard?.classList.add('active');
            btnViewProfile?.classList.remove('active');
            subPageLeaderboard?.classList.remove('hidden');
            subPageProfile?.classList.add('hidden');
        } else if (target === 'profile') {
            btnViewProfile?.classList.add('active');
            btnViewLeaderboard?.classList.remove('active');
            subPageProfile?.classList.remove('hidden');
            subPageLeaderboard?.classList.add('hidden');
        }
    }

    if (btnProfileTrigger) {
        btnProfileTrigger.onclick = () => {
            mapView?.classList.add('hidden');
            gameView?.classList.add('hidden');
            profileView?.classList.remove('hidden');
            switchSubPage('leaderboard');
        };
    }

    if (btnViewLeaderboard) btnViewLeaderboard.onclick = () => switchSubPage('leaderboard');
    if (btnViewProfile) btnViewProfile.onclick = () => switchSubPage('profile');

    const tabFriends = document.getElementById('tab-leaderboard-friends');
    const tabGlobal = document.getElementById('tab-leaderboard-global');
    const contentFriends = document.getElementById('content-rank-friends');
    const contentGlobal = document.getElementById('content-rank-global');

    if (tabFriends && tabGlobal) {
        tabFriends.onclick = () => {
            tabFriends.classList.add('active');
            tabGlobal.classList.remove('active');
            contentFriends?.classList.remove('hidden');
            contentGlobal?.classList.add('hidden');
        };

        tabGlobal.onclick = () => {
            tabGlobal.classList.add('active');
            tabFriends.classList.remove('active');
            contentGlobal?.classList.remove('hidden');
            contentFriends?.classList.add('hidden');
        };
    }

    // 修改暱稱
    const modalEditNickname = document.getElementById('modal-edit-nickname');
    document.getElementById('btn-open-edit-nickname').onclick = () => {
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
    };

    document.getElementById('btn-cancel-nickname').onclick = () => {
        modalEditNickname?.classList.add('hidden');
    };

    document.getElementById('btn-save-nickname').onclick = async () => {
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
    };

    // 修改密碼
    const modalChangePassword = document.getElementById('modal-change-password');
    document.getElementById('btn-open-change-password').onclick = () => {
        modalChangePassword?.classList.remove('hidden');
    };

    document.getElementById('btn-cancel-password').onclick = () => {
        modalChangePassword?.classList.add('hidden');
    };

    document.getElementById('btn-save-password').onclick = async () => {
        const newPass = document.getElementById('input-new-password')?.value.trim();
        if (!newPass || newPass.length < 6) return alert("密碼至少需為 6 位數！");

        try {
            await AuthService.updatePassword(newPass);
            alert("密碼修改成功！下次登入請使用新密碼。");
            modalChangePassword?.classList.add('hidden');
        } catch (err) {
            alert(`修改密碼失敗: ${err.message}`);
        }
    };

    // 新增好友 Modal
    const modalAddFriend = document.getElementById('modal-add-friend');
    document.getElementById('btn-open-add-friend').onclick = () => {
        modalAddFriend?.classList.remove('hidden');
    };

    document.getElementById('btn-cancel-add-friend').onclick = () => {
        modalAddFriend?.classList.add('hidden');
    };

    document.getElementById('btn-submit-add-friend').onclick = async () => {
        const friendInput = document.getElementById('input-friend-id')?.value.trim();
        if (!friendInput) return alert("請輸入好友的帳號或暱稱！");

        // 發送邀請示範 logic
        alert(`已成功發送好友邀請給 [${friendInput}]！`);
        modalAddFriend?.classList.add('hidden');
    };

    // 視圖導覽按鈕
    document.getElementById('btn-profile-back-map').onclick = () => {
        profileView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    };

    document.getElementById('btn-close-locked-modal').onclick = () => {
        modalLocked?.classList.add('hidden');
    };

    document.getElementById('btn-close-warmup-ask').onclick = () => {
        modalWarmupAsk?.classList.add('hidden');
    };

    document.getElementById('btn-warmup-yes').onclick = () => {
        modalWarmupAsk?.classList.add('hidden');
        alert("即將進入 Step 2 課前暖身頁面！");
    };

    document.getElementById('btn-warmup-no').onclick = () => {
        modalWarmupAsk?.classList.add('hidden');
        mapView?.classList.add('hidden');
        gameView?.classList.remove('hidden');
    };

    document.getElementById('btn-back-to-map').onclick = () => {
        gameView?.classList.add('hidden');
        mapView?.classList.remove('hidden');
    };

    document.getElementById('btn-trigger-logout').onclick = () => {
        modalLogoutConfirm?.classList.remove('hidden');
    };

    document.getElementById('btn-logout-no').onclick = () => {
        modalLogoutConfirm?.classList.add('hidden');
    };

    document.getElementById('btn-logout-yes').onclick = async () => {
        modalLogoutConfirm?.classList.add('hidden');
        await AuthService.logout();
    };

    renderMapUnits(currentCategory, currentSelectedLevel);
}

function setupAuthEventListeners() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const registerFields = document.getElementById('register-extended-fields');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const loginModal = document.getElementById('login-modal');
    const mainApp = document.getElementById('main-app');

    tabLogin.onclick = () => {
        authMode = 'login';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        registerFields?.classList.add('hidden');
    };

    tabRegister.onclick = () => {
        authMode = 'register';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerFields?.classList.remove('hidden');
    };

    btnSubmit.onclick = async () => {
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
    };

    AuthService.onAuthStateChanged(async (user) => {
        if (user) {
            loginModal?.classList.add('hidden');

            // 1. 查詢 Google 試算表 API 白名單
            const whitelist = await fetchWhitelistData(user.email);
            const today = new Date().toISOString().split('T')[0];

            if (whitelist && whitelist.expireAt && whitelist.expireAt < today) {
                alert("您的帳號使用期限已到期！請聯繫後台管理員重新開通。");
                await AuthService.logout();
                return;
            }

            // 2. 獲取 Firestore 用戶紀錄
            let userData = await FirestoreService.getUserData(user.uid);
            const streakData = checkAndUpdateStreak(userData || {});

            const mergedUserData = {
                uid: user.uid,
                email: user.email,
                nickname: userData?.nickname || whitelist?.nickname || user.email.split('@')[0],
                allowedLevels: whitelist?.allowedLevels || userData?.allowedLevels || ['1A'],
                expireAt: whitelist?.expireAt || userData?.expireAt || '2026-12-31',
                xp: userData?.xp || 0,
                energy: userData?.energy || 100,
                focusHours: userData?.focusHours || 0.0,
                friends: userData?.friends || [],
                friendRequests: userData?.friendRequests || [],
                ...streakData
            };

            await FirestoreService.saveUserData(user.uid, mergedUserData);

            mainApp?.classList.remove('hidden');
            currentSelectedLevel = mergedUserData.allowedLevels[0] || '1A';
            updateUIProfile(mergedUserData);
            renderMapUnits(currentCategory, currentSelectedLevel);

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

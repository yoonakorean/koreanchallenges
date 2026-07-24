// 🔗 Google Apps Script 白名單 API 網址
const GAS_API_URL = "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";

let currentUser = null;
let currentMemberData = null;
let userMemberships = [];
let currentSelectedLevel = '1A';
let friendRequestsUnsubscribe = null;

// 暱稱驗證規範：2~12字，支援中英韓數字
function validateNickname(nickname) {
    const regex = /^[a-zA-Z0-9\u4e00-\u9fa5\uac00-\ud7a3]{2,12}$/;
    return regex.test(nickname);
}

// 檢查暱稱是否在一年的冷卻期內（true 代表可修改，false 代表不可修改）
function canChangeNickname(lastChangeDateStr) {
    if (!lastChangeDateStr) return true;
    const lastDate = new Date(lastChangeDateStr);
    const oneYearLater = new Date(lastDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    return new Date() >= oneYearLater;
}

// 向 GAS 查詢最新 Members + Memberships 白名單
async function fetchGASWhitelist(email) {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_GAS_DEPLOYMENT_ID")) {
        console.warn("GAS_API_URL 未設定，進入預設白名單驗證模式");
        return {
            status: "success",
            member: { email: email, realName: "測試學生", role: "student", status: "active" },
            memberships: [{ courseId: "1A", expireDate: "2027-12-31", status: "active" }]
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 秒超時保護

        const response = await fetch(`${GAS_API_URL}?email=${encodeURIComponent(email)}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`GAS API 狀態碼異常: ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("讀取 GAS 白名單失敗:", err);
        return null;
    }
}

// Google Sign-In 登入流程
async function handleGoogleLogin() {
    const errorDiv = document.getElementById('login-error-msg');
    const loginBtn = document.getElementById('btn-google-login');

    if (errorDiv) errorDiv.classList.add('hidden');
    if (loginBtn) loginBtn.disabled = true;

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' }); // 強制讓使用者選擇帳號

        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        // 1. 查詢 GAS 白名單
        const gasResult = await fetchGASWhitelist(user.email);

        if (!gasResult || gasResult.status !== "success") {
            await firebase.auth().signOut();
            if (errorDiv) {
                errorDiv.innerText = "❌ 存取被拒絕：您的 Email 未開通白名單權限或已被停權！";
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        // 2. 進行 Firebase 資料同步
        await syncUserToFirestore(user, gasResult.member, gasResult.memberships);

    } catch (err) {
        console.error("Google 登入失敗:", err);
        if (errorDiv && err.code !== 'auth/popup-closed-by-user') {
            errorDiv.innerText = `登入失敗: ${err.message}`;
            errorDiv.classList.remove('hidden');
        }
    } finally {
        if (loginBtn) loginBtn.disabled = false;
    }
}

// Members + Memberships 資料同步
async function syncUserToFirestore(authUser, gasMember, gasMemberships) {
    const db = firebase.firestore();
    const memberRef = db.collection('members').doc(authUser.uid);
    const docSnap = await memberRef.get();

    const now = firebase.firestore.FieldValue.serverTimestamp();

    if (!docSnap.exists()) {
        const newMember = {
            uid: authUser.uid,
            email: authUser.email,
            realName: gasMember.realName || "",
            nickname: "",
            photoURL: authUser.photoURL || "",
            role: gasMember.role || "student",
            status: gasMember.status || "active",
            profileCompleted: false,
            xp: 0,
            streak: 1,
            lastLoginDate: new Date().toISOString().split('T')[0],
            lastCourseId: "KR",
            lastLevel: gasMemberships[0]?.courseId || "1A",
            lastUnit: 1,
            lastLesson: 1,
            lastStage: 1,
            createdAt: now,
            updatedAt: now
        };

        await memberRef.set(newMember);
        currentMemberData = newMember;
    } else {
        const existingData = docSnap.data();
        
        const updatedFields = {
            realName: gasMember.realName || existingData.realName || "",
            role: gasMember.role || existingData.role || "student",
            status: gasMember.status || "active",
            photoURL: authUser.photoURL || existingData.photoURL || "",
            updatedAt: now
        };

        await memberRef.update(updatedFields);
        currentMemberData = { ...existingData, ...updatedFields };
    }

    // 同步更新 memberships Collection
    if (Array.isArray(gasMemberships)) {
        for (const ship of gasMemberships) {
            const shipId = `${authUser.uid}_${ship.courseId}`;
            await db.collection('memberships').doc(shipId).set({
                uid: authUser.uid,
                courseId: ship.courseId,
                expireDate: ship.expireDate,
                status: ship.status,
                purchaseDate: ship.purchaseDate || new Date().toISOString().split('T')[0],
                source: "GoogleSheets",
                updatedAt: now
            }, { merge: true });
        }
    }

    const shipsSnap = await db.collection('memberships').where('uid', '==', authUser.uid).get();
    userMemberships = shipsSnap.docs.map(doc => doc.data());

    if (!currentMemberData.profileCompleted || !currentMemberData.nickname) {
        document.getElementById('modal-setup-nickname')?.classList.remove('hidden');
    } else {
        launchMainApp();
    }
}

function launchMainApp() {
    document.getElementById('login-modal')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');

    currentSelectedLevel = currentMemberData.lastLevel || (userMemberships[0]?.courseId || '1A');

    updateHomeMetaBar();
    renderCourseMap();
    listenForFriendRequests(currentMemberData.uid);
}

// 更新首頁頂端資訊列
function updateHomeMetaBar() {
    const lblName = document.getElementById('lbl-username');
    const lblDays = document.getElementById('lbl-login-days');
    const lblXp = document.getElementById('lbl-xp');
    const lblLevel = document.getElementById('lbl-user-level');

    if (lblName) lblName.innerText = currentMemberData?.nickname || '學生';
    if (lblDays) lblDays.innerText = currentMemberData?.streak || 1;
    if (lblXp) lblXp.innerText = currentMemberData?.xp || 0;
    if (lblLevel) lblLevel.innerText = currentSelectedLevel;
}

// 更新 Profile 頁面資料
function updateProfileView() {
    const avatarImg = document.getElementById('profile-user-avatar');
    if (avatarImg) {
        avatarImg.src = currentMemberData?.photoURL || "https://placehold.co/72x72/e2e8f0/475569?text=User";
    }

    const lblNick = document.getElementById('profile-nickname');
    const lblEmail = document.getElementById('profile-email');
    const lblReal = document.getElementById('profile-realname');
    const lblRole = document.getElementById('profile-role');
    const lblStatus = document.getElementById('profile-status');
    const lblXp = document.getElementById('profile-xp');
    const lblStreak = document.getElementById('profile-streak');

    if (lblNick) lblNick.innerText = currentMemberData?.nickname || '學生';
    if (lblEmail) lblEmail.innerText = currentMemberData?.email || '';
    if (lblReal) lblReal.innerText = currentMemberData?.realName || '-';
    if (lblRole) lblRole.innerText = currentMemberData?.role || 'Student';
    if (lblStatus) lblStatus.innerText = currentMemberData?.status === 'active' ? '開通中' : '停權';
    if (lblXp) lblXp.innerText = currentMemberData?.xp || 0;
    if (lblStreak) lblStreak.innerText = currentMemberData?.streak || 1;

    const container = document.getElementById('profile-memberships-list');
    if (container) {
        if (!userMemberships || userMemberships.length === 0) {
            container.innerHTML = `<span style="font-size:0.82rem; color:#9ca3af;">無有效課程紀錄</span>`;
        } else {
            container.innerHTML = userMemberships.map(m => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f9fafb; padding:8px 12px; border-radius:10px; border:1px solid #e5e7eb;">
                    <span class="course-badge-pill">${m.courseId} 課程</span>
                    <span style="font-size:0.8rem; color:#4b5563;">到期日: <strong>${m.expireDate}</strong></span>
                </div>
            `).join('');
        }
    }
}

function renderCourseMap() {
    const container = document.getElementById('units-map-list');
    if (!container) return;

    container.innerHTML = `
        <div class="unit-card">
            <div class="unit-header">
                <div class="unit-title"><i class="fa-solid fa-map-location-dot" style="color: var(--duo-blue);"></i> 韓語 - ${currentSelectedLevel} 學習關卡</div>
            </div>
            <div class="stages-path">
                <button class="stage-btn-3d" data-unit="1" data-stage="1"><i class="fa-solid fa-star"></i> 階段 1</button>
                <button class="stage-btn-3d locked" data-unit="1" data-stage="2"><i class="fa-solid fa-lock"></i> 階段 2</button>
            </div>
        </div>
    `;

    // 關卡點擊事件綁定
    container.querySelectorAll('.stage-btn-3d').forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('locked')) {
                const modal = document.getElementById('modal-locked');
                if (modal) modal.classList.remove('hidden');
            }
        };
    });
}

function listenForFriendRequests(uid) {
    if (friendRequestsUnsubscribe) friendRequestsUnsubscribe();

    const db = firebase.firestore();
    friendRequestsUnsubscribe = db.collection('friendRequests')
        .where('toUid', '==', uid)
        .onSnapshot(snapshot => {
            const badge = document.getElementById('profile-notif-badge');
            if (badge) {
                if (!snapshot.empty) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }
        }, err => {
            console.error("監聽好友邀請失敗:", err);
        });
}

// 🎯 全域安全事件綁定 Helper
function bindClick(elementId, handler) {
    const el = document.getElementById(elementId);
    if (el) {
        el.onclick = handler;
    }
}

function setupEvents() {
    // 登入按鈕
    bindClick('btn-google-login', handleGoogleLogin);

    // 首次設定暱稱儲存
    bindClick('btn-save-initial-nickname', async () => {
        const inputEl = document.getElementById('input-setup-nickname');
        const input = inputEl ? inputEl.value.trim() : '';
        const errDiv = document.getElementById('nickname-error-msg');

        if (!validateNickname(input)) {
            if (errDiv) {
                errDiv.innerText = "❌ 暱稱需為 2~12 字，僅能包含中文、英文、韓文及數字！";
                errDiv.classList.remove('hidden');
            }
            return;
        }

        const db = firebase.firestore();
        const existing = await db.collection('members').where('nickname', '==', input).get();
        if (!existing.empty) {
            if (errDiv) {
                errDiv.innerText = "❌ 此暱稱已被其他人使用，請換一個！";
                errDiv.classList.remove('hidden');
            }
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        await db.collection('members').doc(currentMemberData.uid).update({
            nickname: input,
            profileCompleted: true,
            lastNicknameChange: today
        });

        currentMemberData.nickname = input;
        currentMemberData.profileCompleted = true;
        currentMemberData.lastNicknameChange = today;

        document.getElementById('modal-setup-nickname')?.classList.add('hidden');
        launchMainApp();
    });

    // 設定/個人頁面 - 暱稱修改儲存按鈕處理
    bindClick('btn-save-nickname', async () => {
        const inputEl = document.getElementById('input-edit-nickname');
        const input = inputEl ? inputEl.value.trim() : '';
        const errDiv = document.getElementById('edit-nickname-error-msg');

        if (!canChangeNickname(currentMemberData?.lastNicknameChange)) {
            if (errDiv) {
                errDiv.innerText = "❌ 暱稱一年僅能修改一次，目前尚未滿足修改冷卻時間！";
                errDiv.classList.remove('hidden');
            }
            return;
        }

        if (!validateNickname(input)) {
            if (errDiv) {
                errDiv.innerText = "❌ 暱稱需為 2~12 字，僅能包含中文、英文、韓文及數字！";
                errDiv.classList.remove('hidden');
            }
            return;
        }

        const db = firebase.firestore();
        const existing = await db.collection('members').where('nickname', '==', input).get();
        if (!existing.empty && input !== currentMemberData.nickname) {
            if (errDiv) {
                errDiv.innerText = "❌ 此暱稱已被其他人使用！";
                errDiv.classList.remove('hidden');
            }
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        await db.collection('members').doc(currentMemberData.uid).update({
            nickname: input,
            lastNicknameChange: today
        });

        currentMemberData.nickname = input;
        currentMemberData.lastNicknameChange = today;

        document.getElementById('modal-edit-nickname')?.classList.add('hidden');
        updateHomeMetaBar();
        updateProfileView();
    });

    // 頁面切換相關
    bindClick('btn-profile-trigger', () => {
        document.getElementById('map-view')?.classList.add('hidden');
        document.getElementById('profile-view')?.classList.remove('hidden');
        updateProfileView();
    });

    bindClick('btn-level-trigger', () => {
        document.getElementById('modal-select-initial-level')?.classList.remove('hidden');
    });

    bindClick('btn-close-level-modal', () => {
        document.getElementById('modal-select-initial-level')?.classList.add('hidden');
    });

    bindClick('btn-confirm-initial-level', () => {
        const select = document.getElementById('initial-level-select');
        if (select) {
            currentSelectedLevel = select.value;
            updateHomeMetaBar();
            renderCourseMap();
        }
        document.getElementById('modal-select-initial-level')?.classList.add('hidden');
    });

    bindClick('btn-profile-back-map', () => {
        document.getElementById('profile-view')?.classList.add('hidden');
        document.getElementById('map-view')?.classList.remove('hidden');
    });

    // 個人主頁標籤頁切換
    bindClick('btn-view-leaderboard', () => {
        document.getElementById('btn-view-leaderboard')?.classList.add('active');
        document.getElementById('btn-view-profile')?.classList.remove('active');
        document.getElementById('sub-page-leaderboard')?.classList.remove('hidden');
        document.getElementById('sub-page-profile')?.classList.add('hidden');
    });

    bindClick('btn-view-profile', () => {
        document.getElementById('btn-view-profile')?.classList.add('active');
        document.getElementById('btn-view-leaderboard')?.classList.remove('active');
        document.getElementById('sub-page-profile')?.classList.remove('hidden');
        document.getElementById('sub-page-leaderboard')?.classList.add('hidden');
        updateProfileView();
    });

    // Modal 開啟/關閉
    bindClick('btn-open-edit-nickname', () => {
        const inputEl = document.getElementById('input-edit-nickname');
        if (inputEl) inputEl.value = currentMemberData?.nickname || '';
        document.getElementById('modal-edit-nickname')?.classList.remove('hidden');
    });
    bindClick('btn-cancel-nickname', () => {
        document.getElementById('modal-edit-nickname')?.classList.add('hidden');
    });

    bindClick('btn-open-add-friend', () => {
        document.getElementById('modal-add-friend')?.classList.remove('hidden');
    });
    bindClick('btn-cancel-add-friend', () => {
        document.getElementById('modal-add-friend')?.classList.add('hidden');
    });

    bindClick('btn-close-locked-modal', () => {
        document.getElementById('modal-locked')?.classList.add('hidden');
    });

    // 登出流程
    bindClick('btn-trigger-logout', () => {
        document.getElementById('modal-logout-confirm')?.classList.remove('hidden');
    });
    bindClick('btn-logout-no', () => {
        document.getElementById('modal-logout-confirm')?.classList.add('hidden');
    });
    bindClick('btn-logout-yes', async () => {
        await firebase.auth().signOut();
        location.reload();
    });
}

// 啟動與監聽 Firebase 驗證狀態
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        const db = firebase.firestore();
        const docSnap = await db.collection('members').doc(user.uid).get();

        if (docSnap.exists()) {
            currentMemberData = docSnap.data();
            const shipsSnap = await db.collection('memberships').where('uid', '==', user.uid).get();
            userMemberships = shipsSnap.docs.map(doc => doc.data());

            if (!currentMemberData.profileCompleted || !currentMemberData.nickname) {
                document.getElementById('modal-setup-nickname')?.classList.remove('hidden');
            } else {
                launchMainApp();
            }
        } else {
            document.getElementById('login-modal')?.classList.remove('hidden');
            document.getElementById('main-app')?.classList.add('hidden');
        }
    } else {
        document.getElementById('login-modal')?.classList.remove('hidden');
        document.getElementById('main-app')?.classList.add('hidden');
    }
});

// 初始化 Event Listener
setupEvents();

// 使用者身分與登入狀態模組
let isRegisterMode = false;
const CONFIG_SHOW_REALNAME_BIRTH = true;

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const extendedFields = document.getElementById("register-extended-fields");
const authSubmitBtn = document.getElementById("btn-auth-submit");

tabLogin.addEventListener("click", () => {
    isRegisterMode = false;
    tabLogin.style.borderBottom = "2px solid var(--primary)";
    tabRegister.style.color = "#6b7280"; tabRegister.style.borderBottom = "none";
    extendedFields.classList.add("hidden");
    authSubmitBtn.innerText = "登入";
});

tabRegister.addEventListener("click", () => {
    isRegisterMode = true;
    tabRegister.style.borderBottom = "2px solid var(--primary)";
    tabLogin.style.color = "#6b7280"; tabLogin.style.borderBottom = "none";
    if(CONFIG_SHOW_REALNAME_BIRTH) extendedFields.classList.remove("hidden");
    authSubmitBtn.innerText = "註冊新帳號";
});

authSubmitBtn.addEventListener("click", async () => {
    try {
        const email = document.getElementById("email-input").value.trim();
        const password = document.getElementById("password-input").value.trim();
        
        if(!email || !password) { UI.showPopup("請填入完整帳號密碼"); return; }

        if(isRegisterMode) {
            const realName = document.getElementById("realname-input").value.trim();
            const birthday = document.getElementById("birthday-input").value;
            const nickname = document.getElementById("nickname-input").value.trim() || "新同學";
            
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            window.currentUid = userCredential.user.uid;
            
            window.currentUserData = {
                uid: window.currentUid,
                email: email,
                realName: CONFIG_SHOW_REALNAME_BIRTH ? realName : "",
                nickname: nickname,
                birthday: CONFIG_SHOW_REALNAME_BIRTH ? birthday : "",
                role: "member",
                status: "active",
                level: "1A",
                currentCourse: "1A-01",
                points: 0,
                streakDays: 1,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                maxUnlockedUnit: 1,
                maxUnlockedStage: 1,
                leitnerBoxes: {},
                wrongWordsBuffer: [],
                wordProgress: {},    // 5. 預留
                unitProgress: {}     // 5. 預留
            };
            
            await db.collection("users").doc(window.currentUid).set(window.currentUserData);
            UI.showPopup("帳號創建成功！");
            window.enterApp();
        } else {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            window.currentUid = userCredential.user.uid;
            
            const userData = await ProgressModel.loadProgress(window.currentUid);
            if(userData) {
                window.currentUserData = userData;
                await ProgressModel.saveProgress(window.currentUid, {
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                window.enterApp();
            } else {
                UI.showPopup("找不到對應的使用者設定檔！");
            }
        }
    } catch(err) {
        UI.handleError(err, "身分驗證失敗");
    }
});
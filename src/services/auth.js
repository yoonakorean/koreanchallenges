import { FirestoreService } from './firebase.js';

const GAS_API_URL = "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";

export const AuthService = {
    // 監聽驗證狀態
    onAuthStateChanged(callback) {
        firebase.auth().onAuthStateChanged(callback);
    },

    // 檢查 GAS 白名單
    async checkWhitelist(email) {
        try {
            const response = await fetch(`${GAS_API_URL}?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("驗證白名單失敗:", error);
            return { status: "error" };
        }
    },

    // 會員註冊 (帶有白名單嚴格檢查)
    async register(email, password, nickname, birthday) {
        // 1. 先查驗白名單
        const checkRes = await this.checkWhitelist(email);
        if (checkRes.status !== "success" || !checkRes.active) {
            throw new Error("您的 Email 未在會員白名單中或權限尚未開通，無法註冊！請先聯繫管理員。");
        }

        // 2. 建立 Firebase 帳號
        const userCredential = await firebase.auth().createUserWithEmailURI 
            ? await firebase.auth().createUserWithEmailAndPassword(email, password)
            : await firebase.auth().createUserWithEmailAndPassword(email, password);

        const user = userCredential.user;

        // 3. 建立 Firestore 使用者檔案 (初始連續登入天數為 0，需完成關卡才計算)
        const userData = {
            uid: user.uid,
            email: email,
            nickname: nickname || "學習者",
            birthday: birthday || "",
            allowedLevels: checkRes.allowedLevels || ["1A"],
            currentLevel: checkRes.allowedLevels ? checkRes.allowedLevels[0] : "1A",
            xp: 0,
            energy: 100,
            loginDays: 0,
            lastCompletedDate: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await FirestoreService.setUserData(user.uid, userData);
        return user;
    },

    // 會員登入
    async login(email, password) {
        return await firebase.auth().signInWithEmailAndPassword(email, password);
    },

    // 登出
    async logout() {
        return await firebase.auth().signOut();
    }
};

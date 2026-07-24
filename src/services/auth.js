import { FirestoreService } from './firebase.js';

// 請替換為您正確的 GAS 部署 URL (若暫無可保持現狀)
const GAS_API_URL = "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";

export const AuthService = {
    // 監聽驗證狀態
    onAuthStateChanged(callback) {
        firebase.auth().onAuthStateChanged(callback);
    },

    // 檢查 GAS 白名單
    async checkWhitelist(email) {
        if (!GAS_API_URL || GAS_API_URL.includes("YOUR_GAS_DEPLOYMENT_ID")) {
            console.warn("GAS_API_URL 未設定，預設全權限運作。");
            return { status: "success", active: true, allowedLevels: ["0A", "1A"] };
        }
        try {
            const response = await fetch(`${GAS_API_URL}?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("驗證白名單失敗:", error);
            return { status: "error" };
        }
    },

    // 會員註冊 (含白名單檢查)
    async register(email, password, nickname, birthday) {
        const checkRes = await this.checkWhitelist(email);
        if (checkRes.status !== "success" || !checkRes.active) {
            throw new Error("您的 Email 未在會員白名單中或權限尚未開通，無法註冊！請先聯繫管理員。");
        }

        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userData = {
            uid: user.uid,
            email: email,
            nickname: nickname || "學習者",
            birthday: birthday || "",
            allowedLevels: checkRes.allowedLevels || ["1A"],
            currentLevel: checkRes.allowedLevels ? checkRes.allowedLevels[0] : "1A",
            xp: 0,
            loginDays: 0, // 初始 0 天，必須完成一次關卡才算 1 天
            lastCompletedDate: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await FirestoreService.saveUserData(user.uid, userData);
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

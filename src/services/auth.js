// 引用 Firebase Auth 實例 (使用相容版 CDN 全域變數)
const auth = firebase.auth();

export const AuthService = {
    // 監聽使用者登入狀態變更
    onAuthStateChanged(callback) {
        auth.onAuthStateChanged(user => {
            callback(user);
        });
    },

    // 帳號密碼登入
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            console.error("[AuthService] 登入失敗:", error.message);
            throw error;
        }
    },

    // 新用戶註冊
    async register(email, password) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            return userCredential.user;
        } catch (error) {
            console.error("[AuthService] 註冊失敗:", error.message);
            throw error;
        }
    },

    // 登出
    async logout() {
        return await auth.signOut();
    },

    // 取得目前登入的使用者
    getCurrentUser() {
        return auth.currentUser;
    }
};

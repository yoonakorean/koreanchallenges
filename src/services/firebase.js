// Firestore 資料庫服務模組
export class FirestoreService {
    // 取得使用者資料
    static async getUserData(uid) {
        try {
            const db = firebase.firestore();
            const docRef = db.collection('users').doc(uid);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error("讀取使用者資料失敗:", error);
            throw error;
        }
    }

    // 新增/覆寫使用者資料
    static async saveUserData(uid, data) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(uid).set(data, { merge: true });
        } catch (error) {
            console.error("儲存使用者資料失敗:", error);
            throw error;
        }
    }

    // 更新部分使用者資料
    static async updateUserData(uid, data) {
        try {
            const db = firebase.firestore();
            await db.collection('users').doc(uid).update(data);
        } catch (error) {
            console.error("更新使用者資料失敗:", error);
            throw error;
        }
    }
}

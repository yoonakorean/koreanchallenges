// Firebase Firestore 服務模組
export const FirestoreService = {
    get db() {
        return firebase.firestore();
    },

    // 取得使用者資料
    async getUserData(uid) {
        try {
            const doc = await this.db.collection('users').doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error("讀取使用者資料失敗:", error);
            throw error;
        }
    },

    // 儲存/更新使用者資料 (同步支援 saveUserData 與 setUserData)
    async saveUserData(uid, data) {
        try {
            return await this.db.collection('users').doc(uid).set(data, { merge: true });
        } catch (error) {
            console.error("儲存使用者資料失敗:", error);
            throw error;
        }
    },

    async setUserData(uid, data) {
        return await this.saveUserData(uid, data);
    },

    // 檢查並更新連續登入天數 (完成關卡時觸發)
    async checkAndUpdateLoginStreak(uid) {
        const userRef = this.db.collection('users').doc(uid);
        const doc = await userRef.get();
        if (!doc.exists) return 0;

        const data = doc.data();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const lastDate = data.lastCompletedDate || "";

        if (lastDate === today) {
            return data.loginDays || 1;
        }

        let newStreak = 1;
        if (lastDate) {
            const last = new Date(lastDate);
            const now = new Date(today);
            const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak = (data.loginDays || 0) + 1;
            }
        }

        await userRef.update({
            loginDays: newStreak,
            lastCompletedDate: today
        });

        return newStreak;
    },

    // 發送好友邀請
    async sendFriendRequest(fromUser, toEmail) {
        const snapshot = await this.db.collection('users').where('email', '==', toEmail).get();
        if (snapshot.empty) {
            throw new Error("找不到該 Email 的使用者！");
        }

        const targetUser = snapshot.docs[0].data();
        if (targetUser.uid === fromUser.uid) {
            throw new Error("不能新增自己為好友喔！");
        }

        const requestRef = this.db.collection('friend_requests').doc();
        await requestRef.set({
            requestId: requestRef.id,
            fromUserId: fromUser.uid,
            fromNickname: fromUser.nickname || "好友",
            toUserId: targetUser.uid,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return true;
    }
};

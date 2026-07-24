export const FirestoreService = {
    db: firebase.firestore(),

    // 取得使用者資料
    async getUserData(uid) {
        const doc = await this.db.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    },

    // 寫入/更新使用者資料
    async setUserData(uid, data) {
        return await this.db.collection('users').doc(uid).set(data, { merge: true });
    },

    // 升級：完成關卡時檢查並更新連續登入天數
    async checkAndUpdateLoginStreak(uid) {
        const userRef = this.db.collection('users').doc(uid);
        const doc = await userRef.get();
        if (!doc.exists) return;

        const data = doc.data();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const lastDate = data.lastCompletedDate || "";

        if (lastDate === today) {
            // 今天已經完成過關卡，天數不重複加
            return data.loginDays || 1;
        }

        let newStreak = 1;
        if (lastDate) {
            const last = new Date(lastDate);
            const now = new Date(today);
            const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // 昨日有完成，連續天數 +1
                newStreak = (data.loginDays || 0) + 1;
            }
        }

        await userRef.update({
            loginDays: newStreak,
            lastCompletedDate: today
        });

        return newStreak;
    },

    // 發送好友邀請 (修復權限問題)
    async sendFriendRequest(fromUser, toEmail) {
        // 1. 搜尋目標 Email 的 UID
        const snapshot = await this.db.collection('users').where('email', '==', toEmail).get();
        if (snapshot.empty) {
            throw new Error("找不到該 Email 的使用者！");
        }

        const targetUser = snapshot.docs[0].data();
        if (targetUser.uid === fromUser.uid) {
            throw new Error("不能新增自己為好友喔！");
        }

        // 2. 建立好友邀請通知
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

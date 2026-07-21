export const FirestoreService = {
    async saveProgress(userId, progressData) {
        console.log(`[Firestore] 保存進度:`, userId, progressData);
        // db.collection('users').doc(userId).update(progressData)
    },
    async loadProgress(userId) {
        console.log(`[Firestore] 讀取進度:`, userId);
        // return await db.collection('users').doc(userId).get()
        return {};
    },
    async saveXP(userId, xpAmount) {
        console.log(`[Firestore] 更新 XP:`, userId, xpAmount);
    },
    async saveReview(userId, wordId, performanceData) {
        console.log(`[Firestore] 保存單字 SRS 複習紀錄:`, userId, wordId, performanceData);
    }
};

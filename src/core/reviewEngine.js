export const ReviewEngine = {
    /**
     * [Phase 2 TODO] 建立今日單字 SRS 複習佇列
     */
    async buildQueue(userId) {
        console.log(`[ReviewEngine] TODO: 為 ${userId} 建立 SRS 複習佇列`);
        return [];
    },

    /**
     * [Phase 2 TODO] 結算 SRS 複習回合
     */
    async finishReview(sessionResult) {
        console.log(`[ReviewEngine] TODO: 結算複習`, sessionResult);
    },

    /**
     * [Phase 2 TODO] 更新特定單字的熟練度 / 記憶曲線
     */
    async saveReview(userId, wordId, performance) {
        console.log(`[ReviewEngine] TODO: 更新單字 ${wordId} 熟練度`, performance);
    }
};

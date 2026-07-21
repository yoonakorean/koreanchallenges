export const AnalyticsService = {
    recordWrongWord(wordId, stage) {
        // TODO: Phase 2 實作錯誤單字統計
        console.log(`[Analytics] 記錄錯誤單字: ${wordId} (Stage: ${stage})`);
    },
    recordResponseTime(questionId, durationMs) {
        // TODO: Phase 2 實作答題時間分析
        console.log(`[Analytics] 記錄答題時間: ${questionId} - ${durationMs}ms`);
    },
    recordStageResult(stageId, score, isPassed) {
        // TODO: Phase 2 實作關卡結果紀錄
        console.log(`[Analytics] 記錄關卡結果: Stage ${stageId}, 得分: ${score}, 通過: ${isPassed}`);
    }
};

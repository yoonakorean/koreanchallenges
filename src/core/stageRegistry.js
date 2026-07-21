class StageRegistry {
    constructor() {
        this.stages = new Map();
    }

    /**
     * 註冊新 Stage
     * @param {string} stageKey - 關卡識別碼 (例: STAGES.VOCAB)
     * @param {Object} stageHandler - 包含 generate, checkAnswer 等實作的物件
     */
    register(stageKey, stageHandler) {
        this.stages.set(stageKey, stageHandler);
    }

    getStage(stageKey) {
        const stage = this.stages.get(stageKey);
        if (!stage) {
            throw new Error(`Stage "${stageKey}" 尚未註冊！`);
        }
        return stage;
    }
}

export const stageRegistry = new StageRegistry();

class StageRegistry {
    constructor() {
        this.stages = new Map();
    }

    /**
     * 動態註冊 Stage 關卡處理器
     */
    register(stageKey, stageHandler) {
        this.stages.set(stageKey, stageHandler);
        console.log(`[StageRegistry] 已成功註冊關卡: ${stageKey}`);
    }

    getStage(stageKey) {
        const stage = this.stages.get(stageKey);
        if (!stage) {
            throw new Error(`[StageRegistry] 錯誤: 關卡 "${stageKey}" 未註冊！`);
        }
        return stage;
    }
}

export const stageRegistry = new StageRegistry();

// 8. Question Factory 實作 (Google Sheets -> Question Factory -> Stage -> UI)
const QuestionFactory = {
    createQueue: (unit, stage) => {
        try {
            let pool = window.globalWordsPool || [];
            let historicalPool = pool.filter(x => x.unit <= unit);
            let currentUnitPool = pool.filter(x => x.unit === unit);
            
            let finalSelection = [];
            let targetSize = (stage === 1) ? 15 : 10;
            let leitnerMap = window.currentUserData.leitnerBoxes || {};
            let slowOrWrongWords = Object.keys(leitnerMap).filter(k => leitnerMap[k].speedAlert === true);

            let candidates = [...currentUnitPool];
            historicalPool.forEach(h => { if(!candidates.includes(h)) candidates.push(h); });
            candidates.forEach(item => { if(finalSelection.length < targetSize) finalSelection.push(item); });

            // 由核心依註冊的各關卡轉譯輸出格式
            return StageRegistry.compile(stage, finalSelection, slowOrWrongWords);
        } catch (error) {
            UI.handleError(error, "題目工廠生成佇列失敗");
            return [];
        }
    }
};

// 2. Learning Engine 重構：Stage Registry 註冊管理模式
const StageRegistry = {
    _stages: {},

    register: (stageNum, handlerInstance) => {
        StageRegistry._stages[stageNum] = handlerInstance;
    },

    compile: (stageNum, baseWords, slowWords) => {
        if (StageRegistry._stages[stageNum] && StageRegistry._stages[stageNum].compile) {
            return StageRegistry._stages[stageNum].compile(baseWords, slowWords);
        }
        return baseWords.map(item => ({...item})); // 預設降級防呆
    },

    run: (stageNum) => {
        if (StageRegistry._stages[stageNum] && StageRegistry._stages[stageNum].render) {
            StageRegistry._stages[stageNum].render();
        }
    }
};
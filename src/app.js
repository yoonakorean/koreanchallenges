import { STAGES } from './config/constants.js';
import { stageRegistry } from './core/stageRegistry.js';
import { QuestionGenerator } from './core/learningEngine.js';

// 1. 初始化註冊各個 Stage 關卡 (以後新增 Stage4 只需在此處 register)
stageRegistry.register(STAGES.VOCAB, {
    generateQuestion: (data) => ({ type: STAGES.VOCAB, word: data.word, prompt: "請拼出這個單字" }),
    verify: (ans, target) => ans === target
});

stageRegistry.register(STAGES.SENTENCE, {
    generateQuestion: (data) => ({ type: STAGES.SENTENCE, sentence: data.sentence, prompt: "請完成句子重組" }),
    verify: (ans, target) => ans === target
});

stageRegistry.register(STAGES.SPEECH, {
    generateQuestion: (data) => ({ type: STAGES.SPEECH, targetSpeech: data.sentence, prompt: "請唸出句子" }),
    verify: (ans, target) => ans === target
});

// 2. 應用程式啟動測試
export function initApp() {
    console.log("🚀 遊戲系統架構 Phase 1 初始化完成！");
    
    // 測試動態生成 Stage 1 題目
    const q1 = QuestionGenerator.createQuestion(STAGES.VOCAB, { word: "apple" });
    console.log("生成題目測試:", q1);
}

// 自動執行初始化
initApp();

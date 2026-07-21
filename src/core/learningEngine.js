import { stageRegistry } from './stageRegistry.js';
import { AnalyticsService } from '../services/analytics.js';

export const QuestionGenerator = {
    createQuestion(stageKey, rawData) {
        const stage = stageRegistry.getStage(stageKey);
        return stage.generateQuestion(rawData);
    }
};

export const AnswerChecker = {
    checkAnswer(stageKey, userAnswer, correctAnswer) {
        const stage = stageRegistry.getStage(stageKey);
        return stage.verify(userAnswer, correctAnswer);
    }
};

export const ResultProcessor = {
    processResult(userAnswerResult, metadata) {
        if (!userAnswerResult.isCorrect) {
            AnalyticsService.recordWrongWord(metadata.wordId, metadata.stage);
        }
        AnalyticsService.recordResponseTime(metadata.questionId, metadata.duration);
        // 計算 XP、扣 HP...
    }
};

export const LearningEngine = {
    goNextQuestion(currentContext) {
        // 取得下一題邏輯
    }
};

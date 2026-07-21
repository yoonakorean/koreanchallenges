 // 3. 建立 Progress Model 模組化封裝
const ProgressModel = {
    loadProgress: async (uid) => {
        try {
            const doc = await db.collection("users").doc(uid).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            UI.handleError(error, "載入進度失敗");
            return null;
        }
    },

    saveProgress: async (uid, data) => {
        try {
            await db.collection("users").doc(uid).update(data);
        } catch (error) {
            UI.handleError(error, "儲存進度失敗");
        }
    },

    updateWordProgress: async (uid, word, isCorrect, elapsed) => {
        try {
            // 5. 預留擴充欄位結構：wordProgress
            if (!window.currentUserData.wordProgress) window.currentUserData.wordProgress = {};
            window.currentUserData.wordProgress[word] = {
                lastTested: firebase.firestore.FieldValue.serverTimestamp(),
                isCorrect: isCorrect,
                elapsed: elapsed
            };
            
            await db.collection("users").doc(uid).update({
                "wordProgress": window.currentUserData.wordProgress,
                "leitnerBoxes": window.currentUserData.leitnerBoxes,
                "points": window.currentUserData.points,
                "wrongWordsBuffer": window.currentUserData.wrongWordsBuffer
            });
        } catch (error) {
            UI.handleError(error, "更新單字天梯失敗");
        }
    },

    updateUnitProgress: async (uid, unit, stage) => {
        try {
            // 5. 預留擴充欄位結構：unitProgress
            if (!window.currentUserData.unitProgress) window.currentUserData.unitProgress = {};
            window.currentUserData.unitProgress[`unit_${unit}`] = {
                maxStage: stage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection("users").doc(uid).update({
                "unitProgress": window.currentUserData.unitProgress,
                "maxUnlockedUnit": window.currentUserData.maxUnlockedUnit,
                "maxUnlockedStage": window.currentUserData.maxUnlockedStage
            });
        } catch (error) {
            UI.handleError(error, "更新單元解鎖狀態失敗");
        }
    },

    resumeLearning: async () => {
        try {
            // 6. Resume 與 7. Daily Review 流程引擎控制點
            UI.showLoading("正在檢查複習進度...");
            const hasReview = await ProgressModel.checkDailyReview();
            
            if (hasReview) {
                UI.showPopup("🔔 您有需要複習的錯題或過慢單字，進入每日複習！");
                // 進入 Daily Review 模式
                window.currentStage = 1; 
                StageRegistry.run(1);
            } else {
                // 回歸上次記錄位置
                const targetUnit = window.currentUserData.maxUnlockedUnit || 1;
                const targetStage = window.currentUserData.maxUnlockedStage || 1;
                window.loadStage(targetUnit, targetStage);
            }
        } catch (error) {
            UI.handleError(error, "恢復學習進度失敗");
        }
    },

    checkDailyReview: async () => {
        // 7. Daily Review 基礎流程判斷
        try {
            const wrongBuffer = window.currentUserData.wrongWordsBuffer || [];
            const leitnerMap = window.currentUserData.leitnerBoxes || {};
            const hasSlowWords = Object.keys(leitnerMap).some(k => leitnerMap[k].speedAlert === true);
            
            return (wrongBuffer.length > 0 || hasSlowWords);
        } catch (error) {
            UI.handleError(error, "檢查複習狀態出錯");
            return false;
        }
    },

    saveAnalytics: async (uid, eventName, payload) => {
        // 5. 預留擴充欄位結構：analytics
        try {
            const ref = db.collection("users").doc(uid).collection("analytics").doc();
            await ref.set({
                event: eventName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                ...payload
            });
        } catch (error) {
            console.error("Analytics error:", error);
        }
    }
};
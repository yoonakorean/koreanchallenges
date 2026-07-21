// 全域狀態機變數綁定到 window 控制器上
window.globalWordsPool = [
    { unit: 1, text: "옷", chinese: "衣服", type: "noun" },
    { unit: 1, text: "책", chinese: "書", type: "noun" },
    { unit: 1, text: "커פי", chinese: "咖啡", type: "noun" },
    { unit: 2, text: "양말", chinese: "襪子", type: "noun" },
    { unit: 2, text: "잡지", chinese: "雜誌", type: "noun" },
    { unit: 2, text: "컴퓨터", chinese: "電腦", type: "noun" },
    { unit: 3, text: "사과", chinese: "蘋果", type: "noun" },
    { unit: 3, text: "물", chinese: "水", type: "noun" },
    { unit: 3, text: "우유", chinese: "牛奶", type: "noun" }
];

window.customQuantifiers = {
    "옷": { ko: "벌", zh: "件" }, "양말": { ko: "켤레", zh: "雙" },
    "잡지": { ko: "권", zh: "本" }, "책": { ko: "권", zh: "本" },
    "커פי": { ko: "잔", zh: "杯" }, "컴퓨터": { ko: "대", zh: "台" },
    "사과": { ko: "개", zh: "個" }, "물": { ko: "잔", zh: "杯" }, "우유": { ko: "병", zh: "瓶" }
};

window.currentUnit = 1;
window.currentStage = 1;
window.currentQueue = [];
window.currentIndex = 0;
window.hp = 5;
window.isAnsweredState = false;
window.roundCorrectCount = 0;
window.selectedPuzzleBlocks = [];
window.wordLevelMap = {}; 
window.level3CorrectCount = 0;
window.questionStartTime = 0;

// 非同步下載 Sheets 外部教材
const contentLoadingPromise = (async () => {
    const data = await SheetsService.loadContent();
    if (data) {
        if (data.vocab.length) {
            window.globalWordsPool = data.vocab.map(row => ({
                unit: parseInt(row[0]), 
                text: row[1], 
                chinese: row[2], 
                type: row[3] || "noun",
                hint: row[4] || "" // 4. 預留將 Hint 直接填在試算表第 5 欄 (E欄)
            }));
        }
        if (data.quantifiers.length) {
            const fresh = {};
            data.quantifiers.forEach(row => { if (row[0]) fresh[row[0]] = { ko: row[1], zh: row[2] }; });
            window.customQuantifiers = fresh;
        }
    }
})();

window.enterApp = async () => {
    try {
        UI.showPage('main-app');
        UI.showLoading("教材同步中...");

        document.getElementById("lbl-username").innerText = window.currentUserData.nickname;
        document.getElementById("lbl-login-days").innerText = window.currentUserData.streakDays || 1;
        document.getElementById("lbl-xp").innerText = window.currentUserData.points || 0;
        document.getElementById("lbl-user-level").innerText = window.currentUserData.level || "1A";

        await contentLoadingPromise;
        setupAppControls();
        
        // 6. 登入 -> Resume() 進度判定鏈
        await ProgressModel.resumeLearning();
    } catch (error) {
        UI.handleError(error, "系統進入主程式失敗");
    }
};

function setupAppControls() {
    const dropdown = document.getElementById("unit-dropdown-selector");
    dropdown.value = window.currentUnit;
    dropdown.onchange = function() {
        const u = parseInt(this.value);
        if(u <= window.currentUserData.maxUnlockedUnit) {
            window.loadStage(u, 1);
        } else {
            UI.showPopup("🔒 該單元尚未解鎖！"); this.value = window.currentUnit;
        }
    };
    document.querySelectorAll(".stage-dot").forEach(dot => {
        dot.onclick = function() {
            const targetS = parseInt(this.getAttribute("data-stage"));
            if(window.currentUnit < window.currentUserData.maxUnlockedUnit || 
              (window.currentUnit === window.currentUserData.maxUnlockedUnit && targetS <= window.currentUserData.maxUnlockedStage)) {
                window.loadStage(window.currentUnit, targetS);
            } else UI.showPopup("🔒 該關卡尚未解鎖！");
        }
    });

    // 提示卡片開關
    document.getElementById("btn-hint-toggle").onclick = () => {
        const box = document.getElementById("hint-text-box");
        box.classList.toggle("hidden");
    };
}

window.loadStage = function(unit, stage) {
    SpeechEngine.stop();
    window.currentUnit = unit; window.currentStage = stage; window.currentIndex = 0; 
    window.roundCorrectCount = 0; window.isAnsweredState = false; window.wordLevelMap = {}; window.level3CorrectCount = 0;
    
    document.getElementById("unit-dropdown-selector").value = window.currentUnit;
    document.getElementById("hint-text-box").classList.add("hidden");
    document.getElementById("btn-hint-toggle").classList.add("hidden");
    document.getElementById("btn-continue").classList.add("hidden");
    document.getElementById("btn-pause-mic").classList.add("hidden");
    document.getElementById("btn-play-correct").classList.add("hidden");
    
    document.querySelectorAll(".stage-dot").forEach(dot => {
        dot.className = "stage-dot" + (parseInt(dot.getAttribute("data-stage")) === window.currentStage ? " active" : "");
    });

    const modeBadge = document.getElementById("lbl-mode-text");
    if(window.currentStage === 3) {
        modeBadge.innerText = "地獄挑戰關"; modeBadge.className = "mode-badge mode-challenge";
        document.getElementById("hp-box").classList.remove("hidden"); window.hp = 5; renderHP();
    } else {
        modeBadge.innerText = "基礎練習關"; modeBadge.className = "mode-badge mode-practice";
        document.getElementById("hp-box").classList.add("hidden");
    }

    // 8. 題目工廠出題
    window.currentQueue = QuestionFactory.createQueue(window.currentUnit, window.currentStage);
    window.showCurrentQuestion();
};

function renderHP() {
    const hpBox = document.getElementById("hp-box"); hpBox.innerHTML = "";
    for(let i=0; i<5; i++) {
        const heart = document.createElement("i"); heart.className = (i < window.hp) ? "fa-solid fa-heart" : "fa-regular fa-heart";
        hpBox.appendChild(heart);
    }
}

window.showCurrentQuestion = function() {
    try {
        if (window.currentStage === 1 && window.level3CorrectCount >= 10) { handleStageComplete(); return; }
        if (window.currentStage > 1 && window.currentIndex >= window.currentQueue.length) { handleStageComplete(); return; }

        window.isAnsweredState = false;
        window.questionStartTime = Date.now();
        document.getElementById("hint-text-box").classList.add("hidden");
        document.getElementById("btn-hint-toggle").classList.add("hidden");
        document.getElementById("btn-continue").classList.add("hidden");
        document.getElementById("btn-pause-mic").classList.add("hidden");
        document.getElementById("btn-play-correct").classList.add("hidden");
        document.getElementById("lbl-status-text").className = "status-msg";
        document.getElementById("lbl-status-text").innerText = "";
        document.getElementById("quiz-options-container").classList.add("hidden");
        document.getElementById("puzzle-selected-zone").classList.add("hidden");
        document.getElementById("puzzle-pool-zone").classList.add("hidden");

        let pct = (window.currentStage === 1) ? (window.level3CorrectCount / 10) * 100 : (window.currentIndex / window.currentQueue.length) * 100;
        document.getElementById("main-progress").style.width = `${pct}%`;

        // 2. 調配 Registry 執行對應渲染
        StageRegistry.run(window.currentStage);
    } catch (error) {
        UI.handleError(error, "出題驅動失敗");
    }
};

window.buildOptionsStage1 = function(correctItem, mode) {
    const container = document.getElementById("quiz-options-container");
    container.innerHTML = "";
    let answers = [correctItem];
    let fullPool = window.globalWordsPool.filter(x => x.text !== correctItem.text && x.unit <= window.currentUnit);
    
    fullPool.sort(() => Math.random() - 0.5);
    for(let i=0; i<fullPool.length; i++) { if(answers.length < 4) answers.push(fullPool[i]); }
    answers.sort(() => Math.random() - 0.5);

    answers.forEach(ans => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = (mode === "zh") ? ans.chinese : ans.text; 
        btn.addEventListener("click", () => { if(!window.isAnsweredState) window.handleAnswerAction(ans.text === correctItem.text); });
        container.appendChild(btn);
    });
};

window.buildPuzzleEngine = function(fullTargetText, correctBlocks) {
    const selectedZone = document.getElementById("puzzle-selected-zone");
    const poolZone = document.getElementById("puzzle-pool-zone");
    selectedZone.classList.remove("hidden"); poolZone.classList.remove("hidden");
    selectedZone.innerHTML = ""; poolZone.innerHTML = "";
    window.selectedPuzzleBlocks = [];

    let distractors = ["개", "있어요.", "주세요.", "이", "가"];
    let finalPool = [...correctBlocks];
    distractors.forEach(d => { if(!finalPool.includes(d) && finalPool.length < correctBlocks.length + 2) finalPool.push(d); });
    finalPool.sort(() => Math.random() - 0.5);

    finalPool.forEach((blockText, idx) => {
        const block = document.createElement("div");
        block.className = "word-block"; block.innerText = blockText;
        block.setAttribute("data-idx", idx);
        block.addEventListener("click", () => {
            if(window.isAnsweredState) return;
            if(block.classList.contains("used")) {
                block.classList.remove("used");
                window.selectedPuzzleBlocks = window.selectedPuzzleBlocks.filter(b => b.idx !== idx);
            } else {
                block.classList.add("used");
                window.selectedPuzzleBlocks.push({ idx: idx, text: blockText, element: block });
            }
            renderSelectedBlocks(fullTargetText, correctBlocks);
        });
        poolZone.appendChild(block);
    });
};

function renderSelectedBlocks(fullTargetText, correctBlocks) {
    const selectedZone = document.getElementById("puzzle-selected-zone");
    selectedZone.innerHTML = "";
    window.selectedPuzzleBlocks.forEach(b => {
        const innerBlock = document.createElement("div");
        innerBlock.className = "word-block"; innerBlock.innerText = b.text;
        selectedZone.appendChild(innerBlock);
    });

    let cleanCurrent = window.selectedPuzzleBlocks.map(x=>x.text).join("").replace(/[.\s]+/g,"");
    let cleanTarget = fullTargetText.replace(/[.\s]+/g,"");
    if(cleanCurrent === cleanTarget || window.selectedPuzzleBlocks.length >= correctBlocks.length) {
        window.handleAnswerAction(cleanCurrent === cleanTarget);
    }
}

window.handleAnswerAction = function(isCorrect) {
    try {
        if(SpeechEngine.micTimeoutTracker) clearTimeout(SpeechEngine.micTimeoutTracker);
        document.getElementById("btn-pause-mic").classList.add("hidden");
        window.isAnsweredState = true;

        const item = window.currentQueue[window.currentIndex];
        let currentLevel = window.wordLevelMap[item.text] || 1;
        let elapsed = (Date.now() - window.questionStartTime) / 1000;

        if(!window.currentUserData.leitnerBoxes) window.currentUserData.leitnerBoxes = {};
        if(!window.currentUserData.leitnerBoxes[item.text]) {
            window.currentUserData.leitnerBoxes[item.text] = { box: 0, speedAlert: false };
        }

        if(isCorrect) {
            window.currentUserData.points += (window.currentStage === 3 ? 5 : 2);
            document.getElementById("lbl-status-text").innerHTML = `<span style="color:var(--success); font-weight:bold;">🥇 答對了！(${elapsed.toFixed(1)}秒)</span>`;
            
            if(elapsed > 7.0) {
                window.currentUserData.leitnerBoxes[item.text].speedAlert = true;
            } else {
                let curBox = window.currentUserData.leitnerBoxes[item.text].box;
                if(curBox < 5) window.currentUserData.leitnerBoxes[item.text].box += 1;
                window.currentUserData.leitnerBoxes[item.text].speedAlert = false;
            }

            if (window.currentStage === 1) {
                if (currentLevel === 2) SpeechEngine.playTTS(item.text);
                if (currentLevel === 3) window.level3CorrectCount++;
                if (window.wordLevelMap[item.text] < 3) window.wordLevelMap[item.text]++;
                
                let nextPos = window.currentIndex + 5;
                if(nextPos > window.currentQueue.length) nextPos = window.currentQueue.length;
                window.currentQueue.splice(nextPos, 0, {...item});
            } else {
                window.roundCorrectCount++;
            }
        } else {
            document.getElementById("lbl-status-text").innerHTML = `<span style="color:var(--danger); font-weight:bold;">❌ 答錯了！正解包含: ${item.text} ${item.chinese || ''}</span>`;
            
            window.currentUserData.leitnerBoxes[item.text].box = 0;
            window.currentUserData.leitnerBoxes[item.text].speedAlert = true; 

            if (window.currentStage === 1) {
                if (currentLevel === 2) SpeechEngine.playTTS(item.text);
                if (window.wordLevelMap[item.text] > 1) window.wordLevelMap[item.text]--;
                
                let failPos = window.currentIndex + 5; 
                if(failPos > window.currentQueue.length) failPos = window.currentQueue.length;
                window.currentQueue.splice(failPos, 0, {...item});
            } else {
                if(!window.currentUserData.wrongWordsBuffer.includes(item.text)){
                    window.currentUserData.wrongWordsBuffer.push(item.text);
                }
                if(window.currentStage === 3) { window.hp--; renderHP(); }
            }
        }

        document.getElementById("lbl-xp").innerText = window.currentUserData.points;
        
        // 呼叫 Progress Model 的更新機制
        ProgressModel.updateWordProgress(window.currentUid, item.text, isCorrect, elapsed);
        ProgressModel.saveAnalytics(window.currentUid, "answer_event", { stage: window.currentStage, isCorrect: isCorrect });

        const correctAudio = item.audioText || item.text;
        const playCorrectBtn = document.getElementById("btn-play-correct");
        playCorrectBtn.classList.remove("hidden");
        playCorrectBtn.onclick = () => SpeechEngine.playTTS(correctAudio);

        if(window.currentStage === 3) {
            if(window.hp <= 0) {
                UI.showPopup("💀 挑戰失敗！正確率未達標，請重新修煉！"); window.loadStage(window.currentUnit, 1);
            } else {
                setTimeout(() => { window.currentIndex++; window.showCurrentQuestion(); }, 2800);
            }
        } else {
            document.getElementById("btn-continue").classList.remove("hidden");
        }
    } catch (error) {
        UI.handleError(error, "答題結果處理異常");
    }
};

document.getElementById("btn-continue").addEventListener("click", () => {
    window.currentIndex++; window.showCurrentQuestion();
});

window.triggerAutoSpeechFlow = function(targetKoreanText) {
    if(!SpeechEngine.recognition) {
        setTimeout(() => { window.handleAnswerAction(true); }, 1500); return;
    }

    SpeechEngine.recognition.lang = 'ko-KR';
    SpeechEngine.micPaused = false;
    
    document.getElementById("lbl-status-text").className = "status-msg listening-active";
    document.getElementById("lbl-status-text").innerHTML = `<i class="fa-solid fa-microphone"></i> 錄音中，請朗讀韓文...`;
    
    setupPauseButton(targetKoreanText);
    
    if(SpeechEngine.micTimeoutTracker) clearTimeout(SpeechEngine.micTimeoutTracker);
    SpeechEngine.micTimeoutTracker = setTimeout(() => {
        SpeechEngine.stop();
        window.handleAnswerAction(false);
    }, 6000);

    try { SpeechEngine.recognition.start(); } catch(e){}

    SpeechEngine.recognition.onresult = function(event) {
        SpeechEngine.stop();
        const userSpeech = event.results[0][0].transcript.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, "");
        let cleanTarget = targetKoreanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, "");
        let similarity = SpeechEngine.getSimilarity(userSpeech, cleanTarget);

        if(similarity >= 0.8) window.handleAnswerAction(true);
        else window.handleAnswerAction(false);
    };
};

function setupPauseButton(targetKoreanText) {
    const btn = document.getElementById("btn-pause-mic");
    btn.classList.remove("hidden");
    btn.innerHTML = `<i class="fa-solid fa-pause"></i> 暫停錄音`;
    btn.classList.add("btn-danger"); btn.classList.remove("btn-secondary");

    btn.onclick = function() {
        if(!SpeechEngine.micPaused) {
            SpeechEngine.micPaused = true;
            if(SpeechEngine.micTimeoutTracker) clearTimeout(SpeechEngine.micTimeoutTracker);
            if(SpeechEngine.recognition) { try { SpeechEngine.recognition.stop(); } catch(e){} }
            btn.innerHTML = `<i class="fa-solid fa-play"></i> 繼續錄音`;
            btn.classList.remove("btn-danger"); btn.classList.add("btn-secondary");
            document.getElementById("lbl-status-text").className = "status-msg";
            document.getElementById("lbl-status-text").innerHTML = `<span style="color:var(--warning)">⏸️ 語音偵測已暫停</span>`;
        } else {
            SpeechEngine.micPaused = false;
            document.getElementById("lbl-status-text").className = "status-msg listening-active";
            document.getElementById("lbl-status-text").innerHTML = `<i class="fa-solid fa-microphone"></i> 錄音中，請朗讀韓文...`;
            btn.innerHTML = `<i class="fa-solid fa-pause"></i> 暫停錄音`;
            btn.classList.add("btn-danger"); btn.classList.remove("btn-secondary");
            
            if(SpeechEngine.micTimeoutTracker) clearTimeout(SpeechEngine.micTimeoutTracker);
            SpeechEngine.micTimeoutTracker = setTimeout(() => {
                SpeechEngine.stop();
                window.handleAnswerAction(false);
            }, 6000);
            try { SpeechEngine.recognition.start(); } catch(e){}
        }
    };
}

function handleStageComplete() {
    if(window.currentStage === 1) {
        if(window.level3CorrectCount >= 10) {
            UI.showPopup(`過關🎉 ！晉級階段二！`);
            window.currentUserData.maxUnlockedStage = 2;
            ProgressModel.updateUnitProgress(window.currentUid, window.currentUnit, 2);
            window.loadStage(window.currentUnit, 2);
        } else {
            UI.showPopup(`尚未達標 10 題聽打答對門檻。`); window.loadStage(window.currentUnit, 1);
        }
    } 
    else if(window.currentStage === 2) {
        UI.showPopup("🎉 過關！解鎖階段三盲聽跟讀！");
        window.currentUserData.maxUnlockedStage = 3;
        ProgressModel.updateUnitProgress(window.currentUid, window.currentUnit, 3);
        window.loadStage(window.currentUnit, 3);
    } 
    else if(window.currentStage === 3) {
        if(window.roundCorrectCount >= 7) {
            UI.showPopup(`🏆 完美通關！新單元已解鎖！`);
            window.currentUserData.maxUnlockedUnit = window.currentUnit + 1;
            window.currentUserData.maxUnlockedStage = 1;
            ProgressModel.updateUnitProgress(window.currentUid, window.currentUnit + 1, 1);
            window.loadStage(window.currentUnit + 1, 1);
        } else {
            UI.showPopup(`挑戰失敗，回到階段一重新修煉！`); window.loadStage(window.currentUnit, 1);
        }
    }
}

document.getElementById("btn-tts").addEventListener("click", () => {
    const item = window.currentQueue[window.currentIndex];
    if(item) SpeechEngine.playTTS(item.audioText || item.text);
});
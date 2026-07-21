// 常數對應集
const nativeNumbersMap = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열하나", "열둘", "열셋", "열넷", "열다섯", "열여섯", "열일곱", "열여덟", "열아홉"];
const transformMap = { "하나": "한", "둘": "두", "셋": "세", "넷": "네", "열하나": "열한", "열둘": "열두", "열셋": "열세", "열넷": "열네" };

function hasBatchim(word) {
    if (!word || word.length === 0) return false;
    const charCode = word.charCodeAt(word.length - 1);
    if (charCode < 0xAC00 || charCode > 0xD7A3) return false;
    return (charCode - 0xAC00) % 28 !== 0;
}

// ──────────────────────────────────────────
// 註冊 階段 1
// ──────────────────────────────────────────
StageRegistry.register(1, {
    compile: (baseWords) => {
        return baseWords.map(item => ({...item}));
    },
    render: () => {
        const item = window.currentQueue[window.currentIndex];
        if (!item) return;
        if (!window.wordLevelMap[item.text]) window.wordLevelMap[item.text] = 1;
        let currentLevel = window.wordLevelMap[item.text];

        if (currentLevel === 1) {
            document.getElementById("btn-tts").classList.remove("hidden");
            document.getElementById("quiz-options-container").classList.remove("hidden");
            document.getElementById("lbl-target-text").innerText = item.text;
            window.buildOptionsStage1(item, "zh");
            SpeechEngine.playTTS(item.text);
        } 
        else if (currentLevel === 2) {
            document.getElementById("btn-tts").classList.add("hidden");
            document.getElementById("quiz-options-container").classList.remove("hidden");
            document.getElementById("lbl-target-text").innerText = item.chinese;
            window.buildOptionsStage1(item, "ko");
        } 
        else if (currentLevel === 3) {
            document.getElementById("btn-tts").classList.add("hidden");
            document.getElementById("lbl-target-text").innerText = `${item.chinese}\n(🎤 請開口說出這個韓文單字)`;
            setTimeout(() => { window.triggerAutoSpeechFlow(item.text); }, 1000);
        }
    }
});

// ──────────────────────────────────────────
// 註冊 階段 2 (4. 新結構：Sentence -> GrammarID -> Hint -> Translation)
// ──────────────────────────────────────────
StageRegistry.register(2, {
    compile: (baseWords, slowWords) => {
        let combined = [];
        baseWords.forEach(item => {
            let quantObj = window.customQuantifiers[item.text] || {ko:"개", zh:"個"};
            let randNum = Math.floor(Math.random() * 19) + 1; 
            let numWord = nativeNumbersMap[randNum];
            let displayNumWord = transformMap[numWord] || numWord;
            
            let particle = hasBatchim(item.text) ? "이" : "가";
            let quantParticle = hasBatchim(quantObj.ko) ? "이" : "가";
            
            // A. Sentence 組裝
            let sentenceAudio = ""; 
            let chineseMeaning = "";
            let grammarID = "G_UNKNOWN"; // 預留欄位供 Sheets 填入

            if (item.unit === 1) {
                sentenceAudio = `${item.text}${particle} 있어요.`;
                chineseMeaning = `有${item.chinese}`;
                grammarID = "G_EXISTENCE_01";
            } else if (item.unit === 2) {
                sentenceAudio = `${item.text} ${displayNumWord} ${quantObj.ko}${quantParticle} 있어요.`;
                chineseMeaning = `有${randNum}${quantObj.zh}${item.chinese}`;
                grammarID = "G_QUANTIFIER_02";
            } else {
                sentenceAudio = `${item.text} 주세요.`;
                chineseMeaning = `請給我${item.chinese}`;
                grammarID = "G_REQUEST_03";
            }

            // B. Hint 生成 (目前預設空白，之後讀 Sheets 覆蓋)
            let hintContent = item.hint || ""; 

            let blocks = [item.text];
            if(item.unit === 1) blocks.push(`${particle} 있어요.`);
            else if(item.unit === 2) { blocks.push(displayNumWord); blocks.push(quantObj.ko); blocks.push(`${quantParticle} 있어요.`); }
            else blocks.push("주세요.");

            let isApplicationPuzzle = slowWords.includes(item.text);

            // Step 1: 拼塊題目
            combined.push({ 
                type: 'puzzle', 
                text: item.text, 
                grammarID: grammarID,
                hint: hintContent,
                translation: chineseMeaning, 
                audioText: sentenceAudio, 
                blocks: blocks, 
                step: 1, 
                unit: item.unit, 
                isSpecial: isApplicationPuzzle 
            });
            // Step 2: 讀音跟讀
            combined.push({ 
                type: 'speech', 
                text: item.text, 
                grammarID: grammarID,
                hint: hintContent,
                translation: chineseMeaning, 
                audioText: sentenceAudio, 
                step: 2, 
                unit: item.unit 
            });
        });
        return combined;
    },
    render: () => {
        const item = window.currentQueue[window.currentIndex];
        if (!item) return;

        document.getElementById("btn-tts").classList.remove("hidden");
        
        // 如果有提示內容 (4. Hint) 則顯示提示卡按鈕
        if (item.hint && item.hint.trim() !== "") {
            const btnHint = document.getElementById("btn-hint-toggle");
            const boxHint = document.getElementById("hint-text-box");
            btnHint.classList.remove("hidden");
            boxHint.innerHTML = `<p><strong>文法標籤 (${item.grammarID}):</strong></p><p>${item.hint}</p>`;
        }

        if(item.step === 1) {
            document.getElementById("lbl-target-text").innerText = item.isSpecial ? "🔥 拼句強化挑戰：聽音擺放字塊" : "🎵 聽音擺放字塊完成句子";
            SpeechEngine.playTTS(item.audioText);
            window.buildPuzzleEngine(item.audioText, item.blocks);
        } else {
            document.getElementById("lbl-target-text").innerText = `🔊 請跟讀整句朗讀內容\n[ 意：${item.translation} ]`;
            SpeechEngine.playTTS(item.audioText);
            setTimeout(() => { window.triggerAutoSpeechFlow(item.audioText); }, 1600);
        }
    }
});

// ──────────────────────────────────────────
// 註冊 階段 3
// ──────────────────────────────────────────
StageRegistry.register(3, {
    compile: (baseWords) => {
        return baseWords.map(item => {
            let particle = hasBatchim(item.text) ? "이" : "가";
            return {
                text: `${item.text}${particle} 있어요.`,
                chinese: item.chinese,
                fullChinese: `有${item.chinese}`
            };
        });
    },
    render: () => {
        const item = window.currentQueue[window.currentIndex];
        if (!item) return;
        document.getElementById("btn-tts").classList.remove("hidden");
        document.getElementById("lbl-target-text").innerText = "🔊 盲聽跟讀挑戰...";
        SpeechEngine.playTTS(item.text);
        setTimeout(() => { window.triggerAutoSpeechFlow(item.text); }, 1600);
    }
});

// ──────────────────────────────────────────
// 未來若要擴充 階段 4，隨時只要在此處直接黏貼即可：
// StageRegistry.register(4, { ... });
// ──────────────────────────────────────────
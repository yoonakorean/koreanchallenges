// 語音核心與發音辨識模組
const SpeechEngine = {
    recognition: null,
    micPaused: false,
    micTimeoutTracker: null,

    init: () => {
        try {
            if ('webkitSpeechRecognition' in window || 'speechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                SpeechEngine.recognition = new SpeechRecognition();
                SpeechEngine.recognition.continuous = false;
                SpeechEngine.recognition.interimResults = false;
            }
        } catch (error) {
            console.warn("此瀏覽器環境不完全支援 SpeechRecognition API。");
        }
    },

    playTTS: (text) => {
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(text);
                u.lang = 'ko-KR';
                u.rate = 0.85;
                window.speechSynthesis.speak(u);
            }
        } catch (error) {
            UI.handleError(error, "語音播放錯誤");
        }
    },

    getSimilarity: (s1, s2) => {
        let longer = s1; let shorter = s2;
        if (s1.length < s2.length) { longer = s2; shorter = s1; }
        let longerLength = longer.length;
        if (longerLength === 0) return 1.0;
        return (longerLength - SpeechEngine.editDistance(longer, shorter)) / longerLength;
    },

    editDistance: (s1, s2) => {
        s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
        let costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i == 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue; lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    },

    stop: () => {
        if(SpeechEngine.micTimeoutTracker) clearTimeout(SpeechEngine.micTimeoutTracker);
        if(SpeechEngine.recognition) { try { SpeechEngine.recognition.stop(); } catch(e){} }
        SpeechEngine.micPaused = false;
        document.getElementById("btn-pause-mic").classList.add("hidden");
    }
};

SpeechEngine.init();
import { CONFIG } from '../config/config.js';

export const SpeechModule = {
    speak(text) {
        console.log(`[Speech] 朗讀內容 (${CONFIG.SPEECH.LANGUAGE}):`, text);
    }
};

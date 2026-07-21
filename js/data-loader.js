// 8. Question Factory 的資料輸入來源
const SheetsService = {
    SPREADSHEET_ID: "1DeedlDS577YGuc2suNXtRmym6eL931mUUL5fFTPZj7U",
    API_KEY: "AIzaSyBQTMQv_TOlkHzqVtHZtPYUp4imKA66jjA",

    loadContent: async () => {
        try {
            if (!SheetsService.SPREADSHEET_ID || !SheetsService.API_KEY) {
                console.warn("未設定 Google Sheets 憑證，採用備援題庫。");
                return null;
            }
            const base = `https://sheets.googleapis.com/v4/spreadsheets/${SheetsService.SPREADSHEET_ID}/values`;
            const [vocabRes, quantRes] = await Promise.all([
                fetch(`${base}/Vocab!A2:E?key=${SheetsService.API_KEY}`), // 加讀 E 欄預留做 GrammarID/Hint
                fetch(`${base}/Quantifiers!A2:C?key=${SheetsService.API_KEY}`)
            ]);
            
            const vocabJson = await vocabRes.json();
            const quantJson = await quantRes.json();

            return {
                vocab: vocabJson.values || [],
                quantifiers: quantJson.values || []
            };
        } catch (error) {
            UI.handleError(error, "Google Sheets 讀取失敗");
            return null;
        }
    }
};
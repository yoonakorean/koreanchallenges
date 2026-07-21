// 核心 UI 管理模組與全域錯誤控制 (10. Error)
const UI = {
    showPage: (pageId) => {
        try {
            if (pageId === 'main-app') {
                document.getElementById("login-modal").classList.add("hidden");
                document.getElementById("main-app").classList.remove("hidden");
            } else {
                document.getElementById("main-app").classList.add("hidden");
                document.getElementById("login-modal").classList.remove("hidden");
            }
        } catch (error) {
            UI.handleError(error);
        }
    },

    showPopup: (message) => {
        alert(message);
    },

    showToast: (message, isError = false) => {
        const statusBox = document.getElementById("lbl-status-text");
        if (statusBox) {
            statusBox.className = "status-msg";
            statusBox.style.color = isError ? "var(--danger)" : "var(--success)";
            statusBox.innerText = message;
        }
    },

    showLoading: (text = "載入中...") => {
        const targetDisplay = document.getElementById("lbl-target-text");
        if (targetDisplay) {
            targetDisplay.innerText = text;
        }
    },

    handleError: (error, customMessage = "系統發生未知錯誤") => {
        // 10. Error 統一捕捉模型
        console.error("─── [ERROR CONSOLE] ───\n", error);
        UI.showToast(`🚨 ${customMessage}: ${error.message || error}`, true);
    }
};
export const UIModule = {
    renderQuestion(questionData) {
        console.log(`[UI] 渲染題目至畫面:`, questionData);
    },
    updateHP(hp) {
        console.log(`[UI] 更新血量顯示: ${hp}`);
    }
};

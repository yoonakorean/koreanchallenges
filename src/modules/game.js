import { CONFIG } from '../config/config.js';

export const GameModule = {
    currentHP: CONFIG.GAME.MAX_HP,

    deductHP() {
        this.currentHP = Math.max(0, this.currentHP - 1);
        console.log(`[Game] 扣血，剩餘 HP: ${this.currentHP}`);
    }
};

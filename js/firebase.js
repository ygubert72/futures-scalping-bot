// ============================================================
//  FIREBASE (СОХРАНЕНИЕ И ЗАГРУЗКА СДЕЛОК)
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, push, set, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyDaHs-CLoLaAfBDMsTL35DfjhtLryAkaB0",
    authDomain: "futures-scalping-bot.firebaseapp.com",
    projectId: "futures-scalping-bot",
    storageBucket: "futures-scalping-bot.firebasestorage.app",
    messagingSenderId: "29947087757",
    appId: "1:29947087757:web:a3eef514422c8810b44bc4",
    databaseURL: "https://futures-scalping-bot-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
console.log('🔥 Firebase готов!');

// ============================================================
//  СОХРАНЕНИЕ СДЕЛОК В FIREBASE
// ============================================================
const originalExecuteTrade = window.executeTrade;
window.executeTrade = function(instrument, side, price) {
    const result = originalExecuteTrade(instrument, side, price);
    if (side === 'sell') {
        const lastTrade = STATE.trades[STATE.trades.length - 1];
        if (lastTrade) {
            push(ref(db, 'trades'), {
                instrument: lastTrade.instrument,
                side: lastTrade.side,
                price: lastTrade.price,
                profit: lastTrade.profit,
                timestamp: lastTrade.timestamp,
                balance: STATE.balance
            }).then(() => {
                console.log('✅ Сделка сохранена в Firebase');
            }).catch((error) => {
                console.error('❌ Ошибка сохранения в Firebase:', error);
            });
        }
    }
    return result;
};

// ============================================================
//  ЗАГРУЗКА ИСТОРИИ ИЗ FIREBASE
// ============================================================
async function loadTradesFromFirebase() {
    try {
        const tradesRef = ref(db, 'trades');
        const snapshot = await get(tradesRef);
        const data = snapshot.val();
        
        if (data) {
            const trades = Object.values(data);
            const lastTrade = trades[trades.length - 1];
            if (lastTrade && lastTrade.balance) {
                STATE.balance = lastTrade.balance;
            }
            
            let count = 0;
            trades.forEach(t => {
                if (t.timestamp && t.price) {
                    STATE.trades.push({
                        id: Date.now() + Math.random() * count,
                        instrument: t.instrument || 'RTS',
                        side: t.side || 'sell',
                        price: t.price || 0,
                        profit: t.profit || 0,
                        timestamp: t.timestamp || new Date().toISOString(),
                        timeStr: new Date(t.timestamp).toLocaleTimeString()
                    });
                    STATE.stats.total++;
                    if (t.profit > 0) STATE.stats.wins++;
                    else STATE.stats.losses++;
                    STATE.stats.profit += t.profit || 0;
                    count++;
                }
            });
            
            console.log(`📥 Загружено ${count} сделок из Firebase`);
            render();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки истории:', error);
    }
}

loadTradesFromFirebase();

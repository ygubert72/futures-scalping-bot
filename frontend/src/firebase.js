import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, remove } from 'firebase/database';

// Ваша конфигурация (скопированная с экрана)
const firebaseConfig = {
  apiKey: "AIzaSyDaHs-CLoLaAfBDMsTL35DfjhtLryAkaB0",
  authDomain: "futures-scalping-bot.firebaseapp.com",
  projectId: "futures-scalping-bot",
  storageBucket: "futures-scalping-bot.firebasestorage.app",
  messagingSenderId: "29947087757",
  appId: "1:29947087757:web:a3eef514422c8810b44bc4",
  // ДОБАВЛЯЕМ databaseURL вручную
  databaseURL: "https://futures-scalping-bot-default-rtdb.europe-west1.firebasedatabase.app"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация Realtime Database
const db = getDatabase(app);

// Экспортируем всё, что понадобится
export { db, ref, onValue, set, update, push, remove };

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 請確保這裡填入您原本 Firebase Console 的 config 設定
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 匯出獲取使用者資料函式 (修復 Uncaught SyntaxError)
export async function getUserData(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("讀取使用者資料失敗:", error);
    return null;
  }
}

// 匯出儲存/更新使用者資料函式
export async function saveUserData(uid, data) {
  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    console.error("儲存使用者資料失敗:", error);
  }
}

// ==========================================================================
// ตั้งค่า Firebase ของคุณตรงนี้
// วิธีหาค่า: Firebase Console -> Project settings -> General -> Your apps -> SDK setup and configuration
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnhKGBnLpTIaOAvlBhyBcdgA1kH_-Cd1w",
  authDomain: "van-betong.firebaseapp.com",
  projectId: "van-betong",
  storageBucket: "van-betong.firebasestorage.app",
  messagingSenderId: "170306762465",
  appId: "1:170306762465:web:fa863e88c36d42308c29a0"
};

// รหัสลับสำหรับสมัครบัญชีแอดมินคนแรก (แก้เป็นรหัสของคุณเองก่อน deploy แล้วอย่าเผยแพร่)
export const ADMIN_SETUP_KEY = "BETONG888";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

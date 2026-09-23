import { auth, db, ADMIN_SETUP_KEY } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const msgBox = document.getElementById("msgBox");
function showMsg(text, isError) {
  msgBox.innerHTML = `<div class="msg ${isError ? "msg-error" : "msg-ok"}">${text}</div>`;
}
function clearMsg() { msgBox.innerHTML = ""; }

// ---- tab switching ----
const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
tabLoginBtn.onclick = () => {
  tabLoginBtn.classList.add("active"); tabRegisterBtn.classList.remove("active");
  loginForm.style.display = ""; registerForm.style.display = "none"; clearMsg();
};
tabRegisterBtn.onclick = () => {
  tabRegisterBtn.classList.add("active"); tabLoginBtn.classList.remove("active");
  registerForm.style.display = ""; loginForm.style.display = "none"; clearMsg();
};
document.getElementById("regIsAdmin").onchange = (e) => {
  document.getElementById("adminKeyField").style.display = e.target.checked ? "" : "none";
};

// redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "app.html";
});

// ---- login ----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "app.html";
  } catch (err) {
    showMsg("เข้าสู่ระบบไม่สำเร็จ: อีเมลหรือรหัสผ่านไม่ถูกต้อง", true);
  }
});

// ---- register ----
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();
  const empId = document.getElementById("regEmpId").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const isAdmin = document.getElementById("regIsAdmin").checked;
  const adminKey = document.getElementById("regAdminKey").value;

  if (isAdmin) {
    if (adminKey !== ADMIN_SETUP_KEY) {
      showMsg("รหัสตั้งค่าระบบไม่ถูกต้อง", true);
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), { role: "admin", empId: empId || null, createdAt: Date.now() });
      window.location.href = "app.html";
    } catch (err) {
      showMsg("สมัครไม่สำเร็จ: " + friendlyError(err), true);
    }
    return;
  }

  // staff registration: empId must match an existing, unlinked staff record
  try {
    const q = query(collection(db, "staff"), where("empId", "==", empId));
    const snap = await getDocs(q);
    if (snap.empty) {
      showMsg("ไม่พบรหัสพนักงานนี้ในระบบ กรุณาให้แอดมินเพิ่มชื่อของคุณก่อน", true);
      return;
    }
    const staffDoc = snap.docs[0];
    if (staffDoc.data().linkedUid) {
      showMsg("รหัสพนักงานนี้ถูกใช้สมัครสมาชิกไปแล้ว", true);
      return;
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), { role: "staff", empId, createdAt: Date.now() });
    await updateDoc(doc(db, "staff", staffDoc.id), { linkedUid: cred.user.uid });
    window.location.href = "app.html";
  } catch (err) {
    showMsg("สมัครไม่สำเร็จ: " + friendlyError(err), true);
  }
});

function friendlyError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "อีเมลนี้ถูกใช้งานแล้ว";
  if (code.includes("weak-password")) return "รหัสผ่านสั้นเกินไป";
  if (code.includes("invalid-email")) return "รูปแบบอีเมลไม่ถูกต้อง";
  return err.message || "เกิดข้อผิดพลาด";
}

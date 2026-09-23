import { db } from "./firebase-config.js";
import {
  collection, doc, setDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ปีที่รับเข้ามาเป็น ค.ศ. (Gregorian) เสมอ ใช้ format YYYY-MM-DD เป็น key
export async function fetchPublicHolidays(gregorianYear) {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${gregorianYear}/TH`);
  if (!res.ok) throw new Error("โหลดวันหยุดราชการไม่สำเร็จ");
  const data = await res.json();
  const batchWrites = data.map((h) =>
    setDoc(doc(db, "holidays", h.date), { name: h.localName || h.name, custom: false }, { merge: true })
  );
  await Promise.all(batchWrites);
  return data.length;
}

export async function getAllHolidays() {
  const snap = await getDocs(collection(db, "holidays"));
  return snap.docs
    .map((d) => ({ date: d.id, ...d.data() }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function addCustomHoliday(dateStr, name) {
  await setDoc(doc(db, "holidays", dateStr), { name, custom: true });
}

export async function removeHoliday(dateStr) {
  await deleteDoc(doc(db, "holidays", dateStr));
}

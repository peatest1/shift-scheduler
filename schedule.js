import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function scheduleId(groupId, yyyyMm) { return `${groupId}_${yyyyMm}`; }

export function daysInMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// สร้างตารางเวรแบบหมุนเวียน (round robin) ให้จำนวนเวรใกล้เคียงกันที่สุดในทุกคน
export function generateRotation(staffList, slotsPerDay, yyyyMm) {
  const n = staffList.length;
  const days = daysInMonth(yyyyMm);
  const assignments = {};
  if (n === 0) return assignments;
  // เลื่อนจุดเริ่มต้นตามเดือน เพื่อไม่ให้คนเดิมได้เวรแรกของทุกเดือนซ้ำกัน
  const [, m] = yyyyMm.split("-").map(Number);
  let pointer = (m * slotsPerDay) % n;
  for (let day = 1; day <= days; day++) {
    const slots = [];
    for (let s = 0; s < slotsPerDay; s++) {
      slots.push(staffList[pointer % n].id);
      pointer++;
    }
    assignments[String(day)] = slots;
  }
  return assignments;
}

export async function saveSchedule(groupId, yyyyMm, assignments) {
  await setDoc(doc(db, "schedules", scheduleId(groupId, yyyyMm)), { assignments, updatedAt: Date.now() });
}

export async function loadSchedule(groupId, yyyyMm) {
  const snap = await getDoc(doc(db, "schedules", scheduleId(groupId, yyyyMm)));
  return snap.exists() ? snap.data().assignments : null;
}

export async function updateCell(groupId, yyyyMm, day, slotIndex, staffId) {
  const current = (await loadSchedule(groupId, yyyyMm)) || {};
  const daySlots = current[String(day)] ? [...current[String(day)]] : [];
  daySlots[slotIndex] = staffId;
  current[String(day)] = daySlots;
  await saveSchedule(groupId, yyyyMm, current);
  return current;
}

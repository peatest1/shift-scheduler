import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DEFAULT_GROUPS = [
  { name: "พนักงานอยู่เวร ชุดที่ 1", slotsPerDay: 3, order: 1 },
  { name: "พนักงานอยู่เวร ชุดที่ 2", slotsPerDay: 3, order: 2 },
  { name: "พนักงานอยู่เวร ชุดที่ 3", slotsPerDay: 3, order: 3 },
  { name: "ผู้ตรวจเวร", slotsPerDay: 2, order: 4 },
  { name: "พนักงานสั่งการ", slotsPerDay: 3, order: 5 },
];

export async function ensureDefaultGroups() {
  const snap = await getDocs(collection(db, "groups"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  DEFAULT_GROUPS.forEach((g) => {
    const ref = doc(collection(db, "groups"));
    batch.set(ref, g);
  });
  await batch.commit();
}

export async function getGroups() {
  const q = query(collection(db, "groups"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStaffByGroup(groupId) {
  const q = query(collection(db, "staff"), where("groupId", "==", groupId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function addStaff(groupId, name, empId) {
  const existing = await getStaffByGroup(groupId);
  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
  await addDoc(collection(db, "staff"), {
    name, empId, groupId, order: maxOrder + 1, linkedUid: null,
  });
}

export async function removeStaff(staffId) {
  await deleteDoc(doc(db, "staff", staffId));
}

export async function moveStaff(groupId, staffId, direction) {
  const list = await getStaffByGroup(groupId);
  const idx = list.findIndex((s) => s.id === staffId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) return;
  const a = list[idx], b = list[swapWith];
  const batch = writeBatch(db);
  batch.update(doc(db, "staff", a.id), { order: b.order });
  batch.update(doc(db, "staff", b.id), { order: a.order });
  await batch.commit();
}

export async function updateGroupSlots(groupId, slotsPerDay) {
  await updateDoc(doc(db, "groups", groupId), { slotsPerDay });
}

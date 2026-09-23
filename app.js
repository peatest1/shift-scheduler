import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ensureDefaultGroups, getGroups, getStaffByGroup, addStaff, removeStaff, moveStaff, updateGroupSlots } from "./staff.js";
import { fetchPublicHolidays, getAllHolidays, addCustomHoliday, removeHoliday } from "./holidays.js";
import { generateRotation, saveSchedule, loadSchedule, updateCell, daysInMonth } from "./schedule.js";

const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
let currentUser = null;
let currentRole = null;
let currentStaffProfile = null; // {id, empId, name, groupId} for logged-in staff
let allGroups = [];
let holidaysMap = {}; // dateStr -> name

function todayISO(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function currentYyyyMm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// -------------------- AUTH GUARD --------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) { await signOut(auth); window.location.href = "index.html"; return; }
  currentRole = userDoc.data().role;
  document.getElementById("whoBox").textContent =
    (currentRole === "admin" ? "แอดมิน" : "พนักงาน") + " · " + user.email;

  document.querySelectorAll(".admin-only").forEach(el => el.style.display = currentRole === "admin" ? "" : "none");
  document.querySelectorAll(".staff-only").forEach(el => el.style.display = currentRole === "staff" ? "" : "none");

  if (currentRole === "admin") await ensureDefaultGroups();
  allGroups = await getGroups();

  if (currentRole === "staff") {
    const empId = userDoc.data().empId;
    for (const g of allGroups) {
      const list = await getStaffByGroup(g.id);
      const found = list.find(s => s.empId === empId);
      if (found) { currentStaffProfile = { ...found, groupName: g.name }; break; }
    }
    switchView("myschedule");
  } else {
    switchView("overview");
    renderOverview();
  }

  buildGroupTabs("staffGroupTabs", onStaffTabSelect);
  buildGroupTabs("scheduleGroupTabs", onScheduleTabSelect);
  document.getElementById("holidayYearInput").value = new Date().getFullYear() + 543;
  document.getElementById("scheduleMonthInput").value = currentYyyyMm();
  document.getElementById("myScheduleMonthInput").value = currentYyyyMm();
});

document.getElementById("logoutBtn").onclick = () => signOut(auth);

// -------------------- NAV --------------------
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});
function switchView(name) {
  document.querySelectorAll(".nav-item").forEach(i => i.classList.toggle("active", i.dataset.view === name));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  if (name === "overview") renderOverview();
  if (name === "holidays") renderHolidayList();
  if (name === "myschedule") renderMySchedule();
}

// -------------------- OVERVIEW --------------------
async function renderOverview() {
  const box = document.getElementById("overviewPanel");
  if (!allGroups.length) allGroups = await getGroups();
  let rows = "";
  for (const g of allGroups) {
    const staff = await getStaffByGroup(g.id);
    rows += `<tr><td class="name-cell">${g.name}</td><td>${staff.length} คน</td><td>${g.slotsPerDay} ช่วง/วัน</td></tr>`;
  }
  box.innerHTML = `
    <table>
      <thead><tr><th style="text-align:left;">กลุ่มเวร</th><th>จำนวนพนักงาน</th><th>ช่วงเวร/วัน</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// -------------------- STAFF MANAGEMENT --------------------
let activeStaffGroupId = null;
function buildGroupTabs(containerId, onSelect) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  allGroups.forEach((g, i) => {
    const btn = document.createElement("button");
    btn.className = "group-tab" + (i === 0 ? " active" : "");
    btn.textContent = g.name;
    btn.onclick = () => {
      box.querySelectorAll(".group-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(g.id);
    };
    box.appendChild(btn);
  });
  if (allGroups.length) onSelect(allGroups[0].id);
}

function onStaffTabSelect(groupId) {
  activeStaffGroupId = groupId;
  renderStaffList();
}

async function renderStaffList() {
  const box = document.getElementById("staffListBox");
  if (!activeStaffGroupId) return;
  const list = await getStaffByGroup(activeStaffGroupId);
  if (!list.length) { box.innerHTML = `<div class="empty-hint">ยังไม่มีพนักงานในกลุ่มนี้</div>`; return; }
  let html = `<table><thead><tr><th style="text-align:left;">ลำดับ</th><th style="text-align:left;">ชื่อ-สกุล</th><th>รหัสพนักงาน</th><th>สถานะบัญชี</th><th>จัดการ</th></tr></thead><tbody>`;
  list.forEach((s, idx) => {
    html += `<tr>
      <td>${idx + 1}</td>
      <td class="name-cell">${s.name}</td>
      <td>${s.empId}</td>
      <td>${s.linkedUid ? '<span class="tag">สมัครแล้ว</span>' : '<span class="tag" style="background:#F7E3DE;">ยังไม่สมัคร</span>'}</td>
      <td>
        <button class="mini-btn" data-act="up" data-id="${s.id}">▲</button>
        <button class="mini-btn" data-act="down" data-id="${s.id}">▼</button>
        <button class="mini-btn" data-act="del" data-id="${s.id}">ลบ</button>
      </td>
    </tr>`;
  });
  html += "</tbody></table>";
  box.innerHTML = html;
  box.querySelectorAll(".mini-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id, act = btn.dataset.act;
      if (act === "up" || act === "down") await moveStaff(activeStaffGroupId, id, act === "up" ? "up" : "down");
      if (act === "del") { if (confirm("ยืนยันลบพนักงานคนนี้?")) await removeStaff(id); }
      renderStaffList();
    };
  });
}

document.getElementById("addStaffBtn").onclick = async () => {
  const name = document.getElementById("newStaffName").value.trim();
  const empId = document.getElementById("newStaffEmpId").value.trim();
  if (!name || !empId || !activeStaffGroupId) return;
  await addStaff(activeStaffGroupId, name, empId);
  document.getElementById("newStaffName").value = "";
  document.getElementById("newStaffEmpId").value = "";
  renderStaffList();
};

// -------------------- HOLIDAYS --------------------
document.getElementById("loadHolidaysBtn").onclick = async () => {
  const buddhistYear = Number(document.getElementById("holidayYearInput").value);
  const gYear = buddhistYear - 543;
  const btn = document.getElementById("loadHolidaysBtn");
  btn.textContent = "กำลังโหลด..."; btn.disabled = true;
  try {
    const count = await fetchPublicHolidays(gYear);
    alert(`โหลดวันหยุดราชการสำเร็จ ${count} วัน`);
    renderHolidayList();
  } catch (e) {
    alert("โหลดไม่สำเร็จ: " + e.message);
  }
  btn.textContent = "โหลดวันหยุดราชการ"; btn.disabled = false;
};

document.getElementById("addHolidayBtn").onclick = async () => {
  const date = document.getElementById("customHolidayDate").value;
  const name = document.getElementById("customHolidayName").value.trim();
  if (!date || !name) return;
  await addCustomHoliday(date, name);
  document.getElementById("customHolidayDate").value = "";
  document.getElementById("customHolidayName").value = "";
  renderHolidayList();
};

async function renderHolidayList() {
  const box = document.getElementById("holidayListBox");
  const list = await getAllHolidays();
  holidaysMap = {};
  list.forEach(h => holidaysMap[h.date] = h.name);
  if (!list.length) { box.innerHTML = `<div class="empty-hint">ยังไม่มีข้อมูลวันหยุด</div>`; return; }
  let html = `<table><thead><tr><th style="text-align:left;">วันที่</th><th style="text-align:left;">ชื่อวันหยุด</th><th>ประเภท</th><th>จัดการ</th></tr></thead><tbody>`;
  list.forEach(h => {
    html += `<tr><td class="name-cell">${h.date}</td><td class="name-cell">${h.name}</td>
      <td>${h.custom ? '<span class="tag">พิเศษ</span>' : 'ราชการ'}</td>
      <td><button class="mini-btn" data-date="${h.date}">ลบ</button></td></tr>`;
  });
  html += "</tbody></table>";
  box.innerHTML = html;
  box.querySelectorAll(".mini-btn").forEach(btn => {
    btn.onclick = async () => { await removeHoliday(btn.dataset.date); renderHolidayList(); };
  });
}

// -------------------- SCHEDULE (ADMIN) --------------------
let activeScheduleGroupId = null;
function onScheduleTabSelect(groupId) {
  activeScheduleGroupId = groupId;
  const g = allGroups.find(x => x.id === groupId);
  document.getElementById("slotsPerDayInput").value = g ? g.slotsPerDay : 3;
  renderScheduleGrid();
}

document.getElementById("scheduleMonthInput").onchange = renderScheduleGrid;

document.getElementById("saveSlotsBtn").onclick = async () => {
  if (!activeScheduleGroupId) return;
  const slots = Number(document.getElementById("slotsPerDayInput").value) || 1;
  await updateGroupSlots(activeScheduleGroupId, slots);
  allGroups = await getGroups();
  alert("บันทึกจำนวนช่วงเวร/วัน เรียบร้อย");
};

document.getElementById("generateScheduleBtn").onclick = async () => {
  if (!activeScheduleGroupId) return;
  const yyyyMm = document.getElementById("scheduleMonthInput").value;
  if (!yyyyMm) { alert("กรุณาเลือกเดือน"); return; }
  const staffList = await getStaffByGroup(activeScheduleGroupId);
  if (!staffList.length) { alert("กลุ่มนี้ยังไม่มีพนักงาน"); return; }
  const slots = Number(document.getElementById("slotsPerDayInput").value) || 1;
  if (!confirm("การสุ่มจะเขียนทับตารางเดือนนี้ของกลุ่มที่เลือก ยืนยันหรือไม่?")) return;
  const assignments = generateRotation(staffList, slots, yyyyMm);
  await saveSchedule(activeScheduleGroupId, yyyyMm, assignments);
  renderScheduleGrid();
};

async function renderScheduleGrid() {
  const box = document.getElementById("scheduleGrid");
  if (!activeScheduleGroupId) return;
  const yyyyMm = document.getElementById("scheduleMonthInput").value || currentYyyyMm();
  const staffList = await getStaffByGroup(activeScheduleGroupId);
  const assignments = (await loadSchedule(activeScheduleGroupId, yyyyMm)) || {};
  if (!holidaysMap || !Object.keys(holidaysMap).length) {
    const list = await getAllHolidays();
    list.forEach(h => holidaysMap[h.date] = h.name);
  }
  if (!staffList.length) { box.innerHTML = `<div class="empty-hint">กลุ่มนี้ยังไม่มีพนักงาน</div>`; return; }
  const numDays = daysInMonth(yyyyMm);
  const [y, m] = yyyyMm.split("-").map(Number);
  const slots = Number(document.getElementById("slotsPerDayInput").value) || 3;

  let head = `<tr><th>วันที่</th><th>วัน</th>`;
  for (let s = 0; s < slots; s++) head += `<th>ช่วง ${s + 1}</th>`;
  head += "</tr>";

  let body = "";
  const perStaffTotal = {}; staffList.forEach(s => perStaffTotal[s.id] = 0);

  for (let d = 1; d <= numDays; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    const iso = todayISO(y, m, d);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = !!holidaysMap[iso];
    const rowClass = isHoliday ? "holiday" : (isWeekend ? "weekend" : "");
    body += `<tr class="${rowClass}"><td>${d}</td><td>${THAI_DOW[dow]}${isHoliday ? " •" : ""}</td>`;
    const daySlots = assignments[String(d)] || [];
    for (let s = 0; s < slots; s++) {
      const currentVal = daySlots[s] || "";
      if (currentVal) perStaffTotal[currentVal] = (perStaffTotal[currentVal] || 0) + 1;
      let options = `<option value="">-</option>` + staffList.map(st =>
        `<option value="${st.id}" ${st.id === currentVal ? "selected" : ""}>${st.name}</option>`).join("");
      body += `<td><select class="cell-select" data-day="${d}" data-slot="${s}">${options}</select></td>`;
    }
    body += "</tr>";
  }

  let totalsRow = `<tr><td colspan="2" class="name-cell">รวมเวรทั้งเดือน</td>`;
  totalsRow += `<td colspan="${slots}" style="text-align:left;">` +
    staffList.map(s => `${s.name}: ${perStaffTotal[s.id] || 0}`).join(" &nbsp;|&nbsp; ") + `</td></tr>`;

  box.innerHTML = `<table>${head}${body}${totalsRow}</table>`;
  box.querySelectorAll(".cell-select").forEach(sel => {
    sel.onchange = async () => {
      await updateCell(activeScheduleGroupId, yyyyMm, sel.dataset.day, Number(sel.dataset.slot), sel.value);
      renderScheduleGrid();
    };
  });
}

// -------------------- MY SCHEDULE (STAFF) --------------------
document.getElementById("myScheduleMonthInput").onchange = renderMySchedule;

async function renderMySchedule() {
  const box = document.getElementById("myScheduleBox");
  if (!currentStaffProfile) {
    box.innerHTML = `<div class="empty-hint">ไม่พบข้อมูลพนักงานที่ผูกกับบัญชีนี้ กรุณาติดต่อแอดมิน</div>`;
    return;
  }
  const yyyyMm = document.getElementById("myScheduleMonthInput").value || currentYyyyMm();
  const assignments = (await loadSchedule(currentStaffProfile.groupId, yyyyMm)) || {};
  const numDays = daysInMonth(yyyyMm);
  const [y, m] = yyyyMm.split("-").map(Number);
  let rows = "";
  let myCount = 0;
  for (let d = 1; d <= numDays; d++) {
    const daySlots = assignments[String(d)] || [];
    const mySlots = daySlots.reduce((acc, id, i) => id === currentStaffProfile.id ? [...acc, i + 1] : acc, []);
    if (!mySlots.length) continue;
    myCount += mySlots.length;
    const dow = new Date(y, m - 1, d).getDay();
    rows += `<tr><td>${d}</td><td>${THAI_DOW[dow]}</td><td>${mySlots.map(s => "ช่วง " + s).join(", ")}</td></tr>`;
  }
  if (!rows) {
    box.innerHTML = `<div class="empty-hint">ยังไม่มีตารางเวรของกลุ่ม "${currentStaffProfile.groupName}" ในเดือนนี้</div>`;
    return;
  }
  box.innerHTML = `
    <p style="margin-bottom:10px;color:var(--ink-soft);font-size:13px;">กลุ่ม: ${currentStaffProfile.groupName} · รวม ${myCount} เวรในเดือนนี้</p>
    <table><thead><tr><th>วันที่</th><th>วัน</th><th style="text-align:left;">ช่วงเวรที่ได้รับมอบหมาย</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

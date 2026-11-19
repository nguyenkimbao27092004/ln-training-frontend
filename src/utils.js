// Tệp: frontend/src/utils.js
import * as XLSX from 'xlsx';

export const API_URL = 'https://ln-training-backend.onrender.com/api';

export const DAYS = [
  { num: 2, label: 'Thứ 2' },
  { num: 3, label: 'Thứ 3' },
  { num: 4, label: 'Thứ 4' },
  { num: 5, label: 'Thứ 5' },
  { num: 6, label: 'Thứ 6' },
  { num: 7, label: 'Thứ 7' },
  { num: 8, label: 'Chủ Nhật' }
];

export const WORKOUT_TYPES = [
  { value: '', label: '-- Chọn buổi tập (Thân trên / Thân dưới...) --' },
  { value: 'Thân trên', label: '💪 Tập Thân Trên (Upper Body)' },
  { value: 'Thân dưới', label: '🦵 Tập Thân Dưới (Lower Body)' },
  { value: 'Full Body', label: '🔥 Tập Toàn Thân (Full Body)' },
  { value: 'Ngực - Vai - Tay sau', label: '🛡️ Push (Ngực - Vai - Tay sau)' },
  { value: 'Lưng - Tay trước', label: '🦅 Pull (Lưng - Xô - Tay trước)' },
  { value: 'Mông - Đùi', label: '🍑 Mông - Đùi (Glutes & Legs)' },
  { value: 'Cardio - Core', label: '🫀 Cardio / Bụng / Thể lực' }
];

export const UPD_MARKER = '@@UPD:';
export const DOUBLE_MARKER = '[CA ĐÔI]';

export const styles = {
  input: { padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', color: '#0f172a' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '12px' },
  modalCard: { background: '#fff', color: '#0f172a', padding: '20px', borderRadius: '14px', width: '460px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.25)', textAlign: 'left' },
  modalTitle: { marginTop: 0, marginBottom: '14px', fontSize: '16.5px', fontWeight: 800, color: '#0f172a' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#1e293b' },
  scopePanel: { background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginTop: '4px', color: '#1e293b' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', gap: '8px' }
};

export function isDoubleSession(sessionOrName) {
  const name = typeof sessionOrName === 'string' ? sessionOrName : (sessionOrName?.clientName || '');
  return name.toUpperCase().includes(DOUBLE_MARKER);
}

export function getCleanSessionName(rawName = '') {
  return rawName.replace(/\[CA ĐÔI\]/gi, '').trim();
}

export function formatSessionNameWithDouble(cleanName = '', isDouble = false) {
  const pure = getCleanSessionName(cleanName);
  return isDouble ? `${pure} ${DOUBLE_MARKER}` : pure;
}

export function splitDoubleClientNames(rawName = '') {
  const clean = getCleanSessionName(rawName);
  if (clean.includes('+')) {
    return clean.split('+').map(part => part.trim()).filter(Boolean);
  }
  return [clean];
}

export function parseClientNoteAndTime(rawNote = '', fallbackUpdatedAt = null) {
  if (!rawNote) {
    return { cleanNote: '', updatedAt: fallbackUpdatedAt };
  }
  const idx = rawNote.indexOf(UPD_MARKER);
  if (idx === -1) {
    return { cleanNote: rawNote, updatedAt: fallbackUpdatedAt };
  }
  const cleanNote = rawNote.slice(0, idx).trim();
  const isoTime = rawNote.slice(idx + UPD_MARKER.length).trim();
  return { cleanNote, updatedAt: isoTime || fallbackUpdatedAt };
}

export function attachUpdateTimestamp(cleanNote = '') {
  const pureNote = parseClientNoteAndTime(cleanNote).cleanNote;
  const nowIso = new Date().toISOString();
  return `${pureNote}${UPD_MARKER}${nowIso}`;
}

export function formatUpdateTime(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mi} — ${dd}/${mm}/${yyyy}`;
}

export function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getCurrentYearMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getMonthRange(yearMonthStr) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  const ddLast = String(lastDay).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${ddLast}`,
    label: `Tháng ${mm}/${y}`
  };
}

export function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { start: fmt(monday), end: fmt(sunday) };
}

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 9999;
  const match = timeStr.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/i);
  if (!match) return 9999;
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}

export function formatHeaderDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  const dayLabel = jsDay === 0 ? 'Chủ Nhật' : `Thứ ${jsDay + 1}`;
  return `${dayLabel}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function exportDailyScheduleExcel({ selectedDate, trainers, sessions, dynamicRowCount, getSortedTrainerSessions }) {
  const aoa = [];
  aoa.push([`GYM DINHLE - LỊCH PT (${formatHeaderDate(selectedDate)})`]);
  aoa.push(['Ca', ...trainers.map(t => t.name)]);

  for (let r = 0; r < dynamicRowCount; r++) {
    const rowData = [r + 1];
    trainers.forEach(trainer => {
      const list = getSortedTrainerSessions(trainer._id);
      const s = list[r];
      if (!s) {
        rowData.push('');
      } else if (s.clientName === 'OFF') {
        rowData.push('OFF');
      } else {
        const cleanName = getCleanSessionName(s.clientName);
        const doubleTag = isDoubleSession(s) ? ' [Ca đôi]' : '';
        const timeLabel = s.time ? ` (${s.time})` : '';
        const cancelPrefix = s.status === 'CANCELLED' ? '[HỦY] ' : '';
        rowData.push(`${cancelPrefix}${cleanName}${doubleTag}${timeLabel}`);
      }
    });
    aoa.push(rowData);
  }

  const footerRow = ['Chốt ca'];
  trainers.forEach(trainer => {
    const validList = sessions.filter(
      s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
    );
    const validCount = validList.length;
    const doubleCount = validList.filter(s => isDoubleSession(s)).length;
    footerRow.push(
      doubleCount > 0 ? `${validCount} (Có ${doubleCount} ca đôi)` : `${validCount}`
    );
  });
  aoa.push(footerRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 10 }, ...trainers.map(() => ({ wch: 24 }))];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: trainers.length } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Lich_PT_${selectedDate}`);
  XLSX.writeFile(wb, `GymDinhLe_Lich_PT_${selectedDate}.xlsx`);
}

export function exportWeeklySummaryExcel({ startDate, endDate, trainers, weeklySummary }) {
  const aoa = [
    [`GYM DINHLE - TỔNG HỢP CA PT (${startDate} đến ${endDate})`],
    ['Huấn Luyện Viên (PT)', 'Chi Tiết Các Ngày Đã Chốt', 'Tổng Số Ca', 'Ghi Chú Ca Đôi']
  ];

  trainers.forEach(trainer => {
    const item = weeklySummary.find(w => String(w._id) === String(trainer._id));
    const sortedBreakdown = [...(item?.dailyBreakdown || [])].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );
    const detailStr =
      sortedBreakdown
        .map(d => {
          const [, mm, dd] = (d.date || '').split('-');
          const dateLabel = dd && mm ? `${dd}/${mm}` : d.date;
          const dbl = d.doubleCount ? ` (có ${d.doubleCount} ca đôi)` : '';
          return `${dateLabel}: ${d.count} ca${dbl}`;
        })
        .join(', ') || 'Chưa có ca chốt';
    const totalDouble = item?.totalDoubleShifts || 0;
    aoa.push([
      trainer.name,
      detailStr,
      item ? item.totalShifts : 0,
      totalDouble > 0 ? `Có ${totalDouble} ca đôi` : 'Không có'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 22 }, { wch: 48 }, { wch: 15 }, { wch: 20 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tong_Hop');
  XLSX.writeFile(wb, `GymDinhLe_Tong_Hop_Ca_${startDate}_den_${endDate}.xlsx`);
}
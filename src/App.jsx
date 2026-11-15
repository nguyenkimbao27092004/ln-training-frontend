// Tệp: frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = 'https://ln-training-backend.onrender.com/api';

const DAYS = [
  { num: 2, label: 'Thứ 2' },
  { num: 3, label: 'Thứ 3' },
  { num: 4, label: 'Thứ 4' },
  { num: 5, label: 'Thứ 5' },
  { num: 6, label: 'Thứ 6' },
  { num: 7, label: 'Thứ 7' },
  { num: 8, label: 'Chủ Nhật' }
];

const UPD_MARKER = '@@UPD:';
const DOUBLE_MARKER = '[CA ĐÔI]';

// Kiểm tra xem ca tập có phải là Ca Đôi hay không
function isDoubleSession(sessionOrName) {
  const name = typeof sessionOrName === 'string' ? sessionOrName : (sessionOrName?.clientName || '');
  return name.toUpperCase().includes(DOUBLE_MARKER);
}

// Lấy tên khách sạch (bỏ nhãn [CA ĐÔI] để hiển thị đẹp trên giao diện)
function getCleanSessionName(rawName = '') {
  return rawName.replace(/\[CA ĐÔI\]/gi, '').trim();
}

// Gắn hoặc gỡ nhãn [CA ĐÔI] vào tên ca tập
function formatSessionNameWithDouble(cleanName = '', isDouble = false) {
  const pure = getCleanSessionName(cleanName);
  return isDouble ? `${pure} ${DOUBLE_MARKER}` : pure;
}

// Tách nội dung ghi chú gốc và mốc thời gian chỉnh sửa lịch tuần
function parseClientNoteAndTime(rawNote = '', fallbackUpdatedAt = null) {
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

// Đính kèm mốc thời gian hiện tại khi lưu lịch tuần
function attachUpdateTimestamp(cleanNote = '') {
  const pureNote = parseClientNoteAndTime(cleanNote).cleanNote;
  const nowIso = new Date().toISOString();
  return `${pureNote}${UPD_MARKER}${nowIso}`;
}

// Định dạng hiển thị Giờ:Phút — Ngày/Tháng/Năm (VD: 08:45 — 15/11/2026)
function formatUpdateTime(isoStr) {
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

function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Lấy tháng hiện tại định dạng YYYY-MM (VD: 2026-11)
function getCurrentYearMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// Tính ngày đầu tháng và cuối tháng từ chuỗi YYYY-MM (VD: 2026-11 -> 2026-11-01 đến 2026-11-30)
function getMonthRange(yearMonthStr) {
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

function getCurrentWeekRange() {
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

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 9999;
  const match = timeStr.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/i);
  if (!match) return 9999;
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}

export default function App() {
  const weekRange = getCurrentWeekRange();

  const [activeTab, setActiveTab] = useState('DAILY');
  const [dailyLayout, setDailyLayout] = useState('BOARD');
  const [isFullscreenBoard, setIsFullscreenBoard] = useState(false);

  const [trainers, setTrainers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [sessions, setSessions] = useState([]);
  const [autoSortTime, setAutoSortTime] = useState(true);

  const [editingSession, setEditingSession] = useState(null);
  const [editForm, setEditForm] = useState({
    trainerId: '',
    time: '',
    clientName: '',
    status: 'SCHEDULED',
    updateScope: 'DAILY',
    isDouble: false,
    mergeWithSessionId: '',
    secondClientName: ''
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    trainerId: '',
    clientId: '',
    clientName: '',
    isDouble: false,
    secondClientId: '',
    secondClientName: '',
    time: '',
    saveToWeekly: false
  });

  const [filterTrainer, setFilterTrainer] = useState('ALL');
  const [searchClient, setSearchClient] = useState('');
  const [sortClientMode, setSortClientMode] = useState('DEFAULT'); // DEFAULT | RECENT
  const [editingClient, setEditingClient] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [weeklySummary, setWeeklySummary] = useState([]);

  // Tự động đổi tên trang web thành Gym DinhLe và cập nhật icon logo
  useEffect(() => {
    document.title = 'Gym DinhLe';
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = '/logo.png';
    fetchInitData();
  }, []);

  useEffect(() => {
    loadDailySchedule(selectedDate);
  }, [selectedDate]);

  const fetchInitData = async () => {
    const res = await axios.get(`${API_URL}/init`);
    setTrainers(res.data.trainers);
    setClients(res.data.clients);
  };

  const loadDailySchedule = async (date) => {
    const res = await axios.post(`${API_URL}/daily-schedule`, { date });
    setSessions(res.data);
  };

  const changeDayBy = (delta) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    const nextStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setSelectedDate(nextStr);
  };

  const getSortedTrainerSessions = (trainerId) => {
    const list = sessions.filter(s => s.trainerId === trainerId);
    if (!autoSortTime) return list;
    return [...list].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  };

  const maxSessionsInColumn = trainers.reduce((max, trainer) => {
    const count = sessions.filter(s => s.trainerId === trainer._id).length;
    return Math.max(max, count);
  }, 0);
  const dynamicRowCount = Math.max(10, maxSessionsInColumn + 1);

  const formatHeaderDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const jsDay = new Date(y, m - 1, d).getDay();
    const dayLabel = jsDay === 0 ? 'Chủ Nhật' : `Thứ ${jsDay + 1}`;
    return `${dayLabel}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  };

  const exportDailyToExcel = () => {
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
  };

  const exportWeeklyToExcel = () => {
    const aoa = [
      [`GYM DINHLE - TỔNG HỢP CA PT (${startDate} đến ${endDate})`],
      ['Huấn Luyện Viên (PT)', 'Chi Tiết Các Ngày Đã Chốt', 'Tổng Số Ca', 'Ghi Chú Ca Đôi']
    ];

    trainers.forEach(trainer => {
      const item = weeklySummary.find(w => w._id === trainer._id);
      const detailStr =
        item?.dailyBreakdown
          ?.map(d => {
            const dbl = d.doubleCount ? ` (có ${d.doubleCount} ca đôi)` : '';
            return `${d.date.slice(5)}: ${d.count} ca${dbl}`;
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
  };

  const handleResyncFromWeekly = async () => {
    if (!window.confirm('Đồng bộ lại lịch ngày này theo Lịch Cố Định Tuần?')) return;
    const res = await axios.post(`${API_URL}/daily-schedule/resync`, { date: selectedDate });
    setSessions(res.data);
  };

  const openEditModal = (session) => {
    if (session.clientName === 'OFF') return;
    setEditingSession(session);
    setEditForm({
      trainerId: session.trainerId,
      time: session.time || '',
      clientName: getCleanSessionName(session.clientName),
      status: session.status,
      updateScope: 'DAILY',
      isDouble: isDoubleSession(session),
      mergeWithSessionId: '',
      secondClientName: ''
    });
  };

  // Lưu mốc thời gian khi sửa từ Lịch Ngày có tích chọn cập nhật Lịch Tuần
  const stampClientWeeklyUpdate = async (clientId) => {
    if (!clientId) return;
    const target = clients.find(c => c._id === clientId);
    if (!target) return;
    const { cleanNote } = parseClientNoteAndTime(target.packageNote, target.updatedAt);
    await axios.put(`${API_URL}/clients/${clientId}`, {
      packageNote: attachUpdateTimestamp(cleanNote)
    });
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    let baseName = editForm.clientName.trim();

    // Nếu người dùng chọn gộp với 1 ca khác trong ngày hoặc nhập thêm tên khách thứ 2
    if (editForm.isDouble) {
      if (editForm.mergeWithSessionId) {
        const targetMerge = sessions.find(s => s._id === editForm.mergeWithSessionId);
        if (targetMerge) {
          const secondClean = getCleanSessionName(targetMerge.clientName);
          if (!baseName.toLowerCase().includes(secondClean.toLowerCase())) {
            baseName = `${baseName} + ${secondClean}`;
          }
          await axios.delete(`${API_URL}/daily-session/${targetMerge._id}`);
        }
      } else if (editForm.secondClientName.trim()) {
        const secondClean = editForm.secondClientName.trim();
        if (!baseName.toLowerCase().includes(secondClean.toLowerCase())) {
          baseName = `${baseName} + ${secondClean}`;
        }
      }
    }

    const finalClientName = formatSessionNameWithDouble(baseName, editForm.isDouble);

    const payload = {
      trainerId: editForm.trainerId,
      time: editForm.time,
      clientName: finalClientName,
      status: editForm.status,
      updateScope: editForm.updateScope
    };

    const res = await axios.put(
      `${API_URL}/daily-session/${editingSession._id}/reschedule`,
      payload
    );

    const nextSessions = sessions
      .filter(s => s._id !== editForm.mergeWithSessionId)
      .map(s => (s._id === editingSession._id ? res.data : s));

    setSessions(nextSessions);

    if (editForm.updateScope === 'WEEKLY') {
      await stampClientWeeklyUpdate(editingSession.clientId);
      await fetchInitData();
    }
    setEditingSession(null);
  };

  const handleQuickToggleCancel = async (session, e) => {
    e.stopPropagation();
    if (session.isLocked) return alert('Ngày này đã khóa sổ! Hãy mở khóa nếu muốn chỉnh sửa.');
    const newStatus = session.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED';
    const res = await axios.put(`${API_URL}/daily-session/${session._id}/reschedule`, {
      status: newStatus,
      updateScope: 'DAILY'
    });
    setSessions(sessions.map(s => (s._id === session._id ? res.data : s)));
  };

  const handleDeleteSession = async () => {
    await axios.delete(`${API_URL}/daily-session/${editingSession._id}`);
    setSessions(sessions.filter(s => s._id !== editingSession._id));
    setEditingSession(null);
  };

  const handleDragStart = (e, sessionId) => {
    e.dataTransfer.setData('sessionId', sessionId);
  };

  const handleDropOnTrainer = async (e, targetTrainerId) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData('sessionId');
    if (!sessionId) return;
    const res = await axios.put(`${API_URL}/daily-session/${sessionId}/reschedule`, {
      trainerId: targetTrainerId,
      updateScope: 'DAILY'
    });
    setSessions(sessions.map(s => (s._id === sessionId ? res.data : s)));
  };

  const handleToggleTrainerOff = async (trainerId) => {
    const res = await axios.post(`${API_URL}/daily-schedule/toggle-off`, {
      date: selectedDate,
      trainerId
    });
    setSessions(res.data);
  };

  const openQuickAddForTrainer = (trainerId) => {
    setAddForm({
      trainerId,
      clientId: '',
      clientName: '',
      isDouble: false,
      secondClientId: '',
      secondClientName: '',
      time: '15h',
      saveToWeekly: false
    });
    setShowAddModal(true);
  };

  const handleAddSession = async (e) => {
    e.preventDefault();
    let combinedName = addForm.clientName.trim();

    if (addForm.isDouble && addForm.secondClientName.trim()) {
      combinedName = `${combinedName} + ${addForm.secondClientName.trim()}`;
    }

    const finalClientName = formatSessionNameWithDouble(combinedName, addForm.isDouble);

    const res = await axios.post(`${API_URL}/daily-session/add`, {
      date: selectedDate,
      trainerId: addForm.trainerId,
      clientId: addForm.clientId || null,
      clientName: finalClientName,
      time: addForm.time,
      saveToWeekly: addForm.saveToWeekly
    });

    setSessions([...sessions, res.data]);

    if (addForm.saveToWeekly) {
      if (addForm.clientId) await stampClientWeeklyUpdate(addForm.clientId);
      if (addForm.isDouble && addForm.secondClientId) {
        await stampClientWeeklyUpdate(addForm.secondClientId);
      }
      await fetchInitData();
    }
    setShowAddModal(false);
  };

  const handleCloseDay = async () => {
    const res = await axios.post(`${API_URL}/daily-schedule/close`, { date: selectedDate });
    setSessions(res.data);
  };

  const handleReopenDay = async () => {
    const res = await axios.post(`${API_URL}/daily-schedule/reopen`, { date: selectedDate });
    setSessions(res.data);
  };

  const handleSaveClientWeekly = async () => {
    const payload = {
      ...editingClient,
      packageNote: attachUpdateTimestamp(editingClient.packageNote)
    };
    const res = await axios.put(`${API_URL}/clients/${editingClient._id}`, payload);
    setClients(clients.map(c => (c._id === editingClient._id ? res.data : c)));
    setEditingClient(null);
  };

  const loadWeeklySummary = async (customStart = startDate, customEnd = endDate) => {
    const res = await axios.get(`${API_URL}/weekly-summary`, {
      params: { startDate: customStart, endDate: customEnd }
    });
    setWeeklySummary(res.data);
  };

  // Chọn nhanh cả tháng (VD: Tháng 11/2026 -> 2026-11-01 đến 2026-11-30)
  const handleSelectFullMonth = (ymStr) => {
    setSelectedMonth(ymStr);
    const { start, end } = getMonthRange(ymStr);
    setStartDate(start);
    setEndDate(end);
    loadWeeklySummary(start, end);
  };

  // Xóa toàn bộ dữ liệu chốt ca của tháng đang chọn (VD: Tháng 11/2026)
  const handleDeleteMonthSessions = async () => {
    const { start, end, label } = getMonthRange(selectedMonth);
    const confirmMsg =
      `BẠN CÓ CHẮC CHẮN MUỐN XÓA DỮ LIỆU CHỐT CA CỦA ${label.toUpperCase()}?\n\n` +
      `• Khoảng thời gian xóa: Từ ${start} đến ${end}\n` +
      `• Danh sách 48 khách hàng và Lịch Tuần cố định vẫn được GIỮ NGUYÊN 100%.\n` +
      `• Hãy chắc chắn bạn đã bấm "Xuất Excel" để lưu báo cáo tháng trước khi xóa!`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await axios.post(`${API_URL}/daily-schedule/clear-range`, {
        startDate: start,
        endDate: end
      });
      alert(`✅ Đã xóa thành công ${res.data.deletedCount} ca tập của ${label} để giải phóng bộ nhớ!`);
      loadWeeklySummary(start, end);
      loadDailySchedule(selectedDate);
    } catch (err) {
      alert('Lỗi khi xóa dữ liệu tháng: ' + (err.response?.data?.error || err.message));
    }
  };

  const isDayLocked = sessions.some(s => s.isLocked);
  const validDaySessions = sessions.filter(s => s.status !== 'CANCELLED');
  const totalValidShifts = validDaySessions.length;
  const totalDoubleShiftsToday = validDaySessions.filter(s => isDoubleSession(s)).length;
  const totalCancelledShifts = sessions.filter(
    s => s.status === 'CANCELLED' && s.clientName !== 'OFF'
  ).length;

  // Lọc và sắp xếp danh sách khách hàng ở Tab 2
  const displayedClients = clients
    .filter(c => filterTrainer === 'ALL' || (c.primaryTrainerId?._id || c.primaryTrainerId) === filterTrainer)
    .filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()))
    .sort((a, b) => {
      if (sortClientMode !== 'RECENT') return 0;
      const timeA = parseClientNoteAndTime(a.packageNote, a.updatedAt).updatedAt;
      const timeB = parseClientNoteAndTime(b.packageNote, b.updatedAt).updatedAt;
      const msA = timeA ? new Date(timeA).getTime() : 0;
      const msB = timeB ? new Date(timeB).getTime() : 0;
      return msB - msA;
    });

  const currentMonthInfo = getMonthRange(selectedMonth);

  return (
    <div className="app-shell">
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body {
          margin: 0; padding: 0;
          background: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
        }
        .app-shell { min-height: 100vh; width: 100%; display: flex; flex-direction: column; text-align: left; }

        /* HEADER GYM DINHLE HIỆN ĐẠI */
        .ProHeader {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff; padding: 12px 18px;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 12px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
        }
        .BrandRow { display: flex; align-items: center; gap: 12px; }
        .BrandLogoImg {
          width: 44px; height: 44px; border-radius: 10px;
          object-fit: contain; background: #ffffff; padding: 2px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); flex-shrink: 0;
        }
        .BrandTitleWrap { display: flex; flex-direction: column; text-align: left; }
        .BrandText {
          margin: 0 !important; font-size: 17px !important; font-weight: 800 !important;
          letter-spacing: 0.3px !important; color: #ffffff !important;
          line-height: 1.2 !important; white-space: nowrap;
        }
        .BrandSub {
          font-size: 11.5px; color: #94a3b8; font-weight: 500; margin-top: 2px;
        }
        .NavGroup {
          display: flex; gap: 4px; background: rgba(255, 255, 255, 0.08);
          padding: 4px; border-radius: 10px;
        }
        .NavBtn {
          border: none; background: transparent; color: #cbd5e1;
          padding: 7px 12px; border-radius: 7px; font-size: 13px;
          font-weight: 600; cursor: pointer; white-space: nowrap; transition: 0.15s;
        }
        .NavBtn.active { background: #3b82f6; color: #fff; box-shadow: 0 2px 6px rgba(59,130,246,0.35); }

        /* THANH CÔNG CỤ CHUẨN SAAS */
        .ToolbarCard {
          background: #fff; margin: 10px 12px 0; padding: 10px 14px;
          border-radius: 12px; border: 1px solid #e2e8f0;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .ToolSection { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .DateControl {
          display: inline-flex; align-items: center; gap: 4px;
          background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 3px 6px;
        }
        .DateInput {
          border: none; background: transparent; font-size: 13.5px;
          font-weight: 700; color: #0f172a; outline: none; min-width: 122px;
        }
        .Btn {
          border: none; border-radius: 8px; padding: 8px 12px;
          font-size: 12.5px; font-weight: 700; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 5px; white-space: nowrap; transition: 0.15s;
        }
        .BtnBlue { background: #2563eb; color: #fff; }
        .BtnLight { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
        .BtnEmerald { background: #059669; color: #fff; }
        .BtnGreen { background: #16a34a; color: #fff; }
        .BtnOrange { background: #ea580c; color: #fff; }
        .BtnDark { background: #1e293b; color: #fff; }
        .BtnRed { background: #e11d48; color: #fff; }

        /* KHUNG BẢNG LỊCH NGÀY FULL MÀN HÌNH & KHÔNG RỚT CHỮ */
        .MainArea { flex: 1; width: 100%; padding: 10px 12px 20px; }
        .BoardCard {
          background: #fff; border-radius: 14px; border: 1px solid #cbd5e1;
          overflow: hidden; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
        }
        .BoardBanner {
          background: linear-gradient(90deg, #fef08a 0%, #fde047 100%);
          padding: 10px 14px; border-bottom: 1px solid #eab308;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 8px;
        }
        .BannerTitle { font-size: 15px; font-weight: 800; color: #713f12; white-space: nowrap; }
        .BannerStats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .StatPill {
          background: rgba(255,255,255,0.85); padding: 4px 10px;
          border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap;
        }

        /* BẢNG MA TRẬN CUỘN MƯỢT VỚI CỘT 'CA' CỐ ĐỊNH */
        .TableScrollBox {
          width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;
        }
        .MatrixTable {
          width: 100%; border-collapse: separate; border-spacing: 0;
          min-width: 980px;
        }
        .MatrixTable th, .MatrixTable td {
          border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
          padding: 6px 8px; vertical-align: middle;
        }
        .StickyCol {
          position: sticky; left: 0; z-index: 10;
          width: 52px; min-width: 52px; max-width: 52px;
          text-align: center; font-weight: 800; font-size: 12.5px;
          background: #f8fafc; border-right: 2px solid #cbd5e1 !important;
          white-space: nowrap;
        }
        .ThTrainer {
          background: #fef9c3; min-width: 138px; text-align: center; padding: 8px 6px !important;
        }
        .TrainerName {
          font-size: 13.5px; font-weight: 800; color: #0f172a;
          white-space: nowrap; margin-bottom: 5px;
        }
        .TrainerActionRow { display: flex; justify-content: center; gap: 5px; }
        .MiniTagBtn {
          border: none; border-radius: 5px; padding: 3px 8px;
          font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;
        }

        /* THẺ KHÁCH TRONG Ô */
        .SessionCard {
          display: flex; align-items: center; justify-content: space-between;
          background: #eff6ff; border: 1px solid #bfdbfe;
          border-left: 3.5px solid #2563eb;
          border-radius: 8px; padding: 5px 8px; gap: 6px;
          cursor: pointer; transition: 0.12s;
        }
        .SessionCard.double-shift {
          background: #f5f3ff; border-color: #ddd6fe;
          border-left: 4px solid #7c3aed;
        }
        .SessionCard:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(37,99,235,0.12); }
        .SessionCard.cancelled {
          background: #f8fafc; border-color: #cbd5e1; border-left-color: #94a3b8; opacity: 0.68;
        }
        .SessionCard.completed {
          background: #ecfdf5; border-color: #a7f3d0; border-left-color: #10b981;
        }
        .SessionCard.off {
          background: #fef3c7; border: 1px dashed #f59e0b; justify-content: center; padding: 6px;
        }
        .SessionInfo {
          display: flex; align-items: center; justify-content: space-between;
          gap: 6px; flex: 1; min-width: 0;
        }
        .ClientTitle {
          font-size: 13px; font-weight: 700; color: #1e293b;
          word-break: keep-all; overflow-wrap: break-word; line-height: 1.25;
          text-align: left;
        }
        .DoubleBadge {
          display: inline-block; background: #7c3aed; color: #fff;
          font-size: 10px; font-weight: 800; padding: 1px 5px;
          border-radius: 4px; margin-right: 4px; white-space: nowrap;
          vertical-align: middle;
        }
        .TimePill {
          background: #fff; color: #1d4ed8; border: 1px solid #bfdbfe;
          font-size: 11.5px; font-weight: 800; padding: 2px 6px;
          border-radius: 6px; white-space: nowrap; flex-shrink: 0;
        }
        .CancelBtn {
          border: none; background: rgba(148, 163, 184, 0.15); color: #64748b;
          width: 20px; height: 20px; border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; cursor: pointer; flex-shrink: 0;
        }
        .CancelBtn:hover { background: #fee2e2; color: #e11d48; }

        /* DÒNG CHỐT CA CUỐI BẢNG */
        .FooterRow td {
          background: #0f172a !important; color: #fff !important;
          padding: 10px 6px !important; text-align: center; font-weight: 800;
          vertical-align: middle;
        }
        .FooterCountBadge {
          display: inline-block; background: #22c55e; color: #fff;
          font-size: 14px; font-weight: 800; padding: 3px 14px;
          border-radius: 20px; white-space: nowrap;
        }
        .FooterDoubleNote {
          margin-top: 5px; font-size: 11px; font-weight: 700;
          color: #fde047; background: rgba(254, 240, 138, 0.16);
          border: 1px solid rgba(253, 224, 71, 0.4);
          padding: 2px 7px; border-radius: 6px; display: inline-block;
          white-space: nowrap;
        }

        /* CHẾ ĐỘ XEM THẺ PT */
        .TrainerCardsGrid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px; padding: 12px; background: #f8fafc;
        }
        .PTCard {
          background: #fff; border-radius: 12px; border: 1px solid #cbd5e1;
          padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);
        }
        .PTCardHeader {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px;
          flex-wrap: wrap; gap: 6px;
        }

        /* TAB 2 & 3: LƯỚI THẺ HIỆN ĐẠI */
        .ClientCardsGrid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 12px; margin-top: 12px;
        }
        .ClientItemCard {
          background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;
          padding: 14px; display: flex; flex-direction: column; gap: 10px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.02); text-align: left;
        }
        .ClientCardTop {
          display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
        }
        .StatusBadge {
          padding: 4px 10px; border-radius: 20px; font-size: 11.5px;
          font-weight: 700; white-space: nowrap; flex-shrink: 0;
        }
        .ScheduleTag {
          background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;
          padding: 4px 9px; border-radius: 6px; font-size: 12px;
          font-weight: 700; white-space: nowrap;
        }
        .ModifiedTimeBox {
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 10px; border-radius: 7px; font-size: 11.5px;
          font-weight: 600; white-space: nowrap;
        }
        .ModifiedTimeBox.edited {
          background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
        }
        .ModifiedTimeBox.unchanged {
          background: #f8fafc; border: 1px dashed #e2e8f0; color: #94a3b8;
        }

        @media (max-width: 768px) {
          .ProHeader { padding: 10px 12px; }
          .BrandText { font-size: 15px !important; }
          .NavGroup { width: 100%; justify-content: space-between; }
          .NavBtn { flex: 1; text-align: center; padding: 7px 6px; font-size: 12px; }
          .ToolbarCard { margin: 8px 8px 0; padding: 10px; }
          .MainArea { padding: 8px 8px 20px; }
        }
      `}</style>

      {/* HEADER GYM DINHLE */}
      {!isFullscreenBoard && (
        <header className="ProHeader">
          <div className="BrandRow">
            <img
              src="/logo.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logo.jpg';
              }}
              alt="Gym DinhLe Logo"
              className="BrandLogoImg"
            />
            <div className="BrandTitleWrap">
              <h1 className="BrandText">GYM DINHLE — LỊCH & CHỐT CA PT</h1>
              <span className="BrandSub">Fitness Center & Personal Trainer</span>
            </div>
          </div>

          <div className="NavGroup">
            <button
              onClick={() => setActiveTab('DAILY')}
              className={`NavBtn ${activeTab === 'DAILY' ? 'active' : ''}`}
            >
              📅 Lịch Ngày
            </button>
            <button
              onClick={() => setActiveTab('CLIENTS')}
              className={`NavBtn ${activeTab === 'CLIENTS' ? 'active' : ''}`}
            >
              👥 Lịch Tuần ({clients.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('SUMMARY');
                loadWeeklySummary();
              }}
              className={`NavBtn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
            >
              📊 Tổng Hợp & Dọn Tháng
            </button>
          </div>
        </header>
      )}

      {/* ==================== TAB 1: LỊCH MỖI NGÀY ==================== */}
      {activeTab === 'DAILY' && (
        <>
          {!isFullscreenBoard && (
            <div className="ToolbarCard">
              <div className="ToolSection">
                <div className="DateControl">
                  <button onClick={() => changeDayBy(-1)} className="Btn BtnLight" style={{ padding: '5px 9px' }}>
                    ◀
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="DateInput"
                  />
                  <button onClick={() => changeDayBy(1)} className="Btn BtnLight" style={{ padding: '5px 9px' }}>
                    ▶
                  </button>
                  <button
                    onClick={() => setSelectedDate(getTodayStr())}
                    className="Btn BtnBlue"
                    style={{ padding: '5px 10px', fontSize: '11.5px' }}
                  >
                    Hôm nay
                  </button>
                </div>

                <button
                  onClick={() => openQuickAddForTrainer(trainers[0]?._id || '')}
                  className="Btn BtnBlue"
                >
                  + Thêm Ca / Ca Đôi
                </button>

                <button onClick={handleResyncFromWeekly} className="Btn BtnLight">
                  🔄 Đồng Bộ Tuần
                </button>
              </div>

              <div className="ToolSection">
                <button
                  onClick={() => setDailyLayout(dailyLayout === 'BOARD' ? 'CARDS' : 'BOARD')}
                  className="Btn BtnDark"
                >
                  {dailyLayout === 'BOARD' ? '📱 Xem Dạng Thẻ PT' : '📊 Xem Bảng Ngang'}
                </button>

                <button onClick={exportDailyToExcel} className="Btn BtnEmerald">
                  📥 Xuất Excel
                </button>

                {!isDayLocked ? (
                  <button onClick={handleCloseDay} className="Btn BtnGreen">
                    ✅ Chốt Ca
                  </button>
                ) : (
                  <button onClick={handleReopenDay} className="Btn BtnOrange">
                    🔓 Mở Khóa
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="MainArea">
            <div className="BoardCard">
              <div className="BoardBanner">
                <span className="BannerTitle">Lịch PT ({formatHeaderDate(selectedDate)})</span>

                <div className="BannerStats">
                  <span className="StatPill" style={{ color: '#1d4ed8' }}>
                    Tổng chốt: {totalValidShifts} ca
                  </span>
                  {totalDoubleShiftsToday > 0 && (
                    <span className="StatPill" style={{ color: '#6d28d9', background: '#ede9fe' }}>
                      👥 Có {totalDoubleShiftsToday} ca đôi
                    </span>
                  )}
                  <span className="StatPill" style={{ color: '#e11d48' }}>
                    Hủy: {totalCancelledShifts}
                  </span>
                  <span className="StatPill" style={{ color: isDayLocked ? '#16a34a' : '#b45309' }}>
                    {isDayLocked ? '🔒 Đã chốt sổ' : '🔓 Đang mở'}
                  </span>

                  <button
                    onClick={() => setIsFullscreenBoard(!isFullscreenBoard)}
                    className="Btn BtnDark"
                    style={{ padding: '4px 10px', fontSize: '11.5px' }}
                  >
                    {isFullscreenBoard ? '✕ Thoát Full' : '⛶ Full Màn Hình'}
                  </button>
                </div>
              </div>

              {/* CHẾ ĐỘ 1: BẢNG MA TRẬN CHUẨN */}
              {dailyLayout === 'BOARD' ? (
                <div className="TableScrollBox">
                  <table className="MatrixTable">
                    <thead>
                      <tr>
                        <th className="StickyCol" style={{ background: '#fef08a' }}>Ca</th>
                        {trainers.map(trainer => {
                          const isOff = sessions.some(
                            s => s.trainerId === trainer._id && s.clientName === 'OFF'
                          );
                          return (
                            <th key={trainer._id} className="ThTrainer">
                              <div className="TrainerName">{trainer.name}</div>
                              <div className="TrainerActionRow">
                                <button
                                  onClick={() => openQuickAddForTrainer(trainer._id)}
                                  className="MiniTagBtn"
                                  style={{ background: '#2563eb', color: '#fff' }}
                                >
                                  + Ca
                                </button>
                                <button
                                  onClick={() => handleToggleTrainerOff(trainer._id)}
                                  className="MiniTagBtn"
                                  style={{
                                    background: isOff ? '#f59e0b' : '#fff',
                                    color: isOff ? '#fff' : '#475569',
                                    border: '1px solid #94a3b8'
                                  }}
                                >
                                  {isOff ? 'Đang OFF' : 'OFF'}
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {[...Array(dynamicRowCount)].map((_, rowIndex) => (
                        <tr
                          key={rowIndex}
                          style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                        >
                          <td className="StickyCol">{rowIndex + 1}</td>

                          {trainers.map(trainer => {
                            const trainerSessions = getSortedTrainerSessions(trainer._id);
                            const cellSession = trainerSessions[rowIndex];
                            const isOffMarker = cellSession?.clientName === 'OFF';
                            const isCancelled = cellSession?.status === 'CANCELLED' && !isOffMarker;
                            const isCompleted = cellSession?.status === 'COMPLETED';
                            const isDouble = cellSession && isDoubleSession(cellSession);

                            return (
                              <td
                                key={trainer._id}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleDropOnTrainer(e, trainer._id)}
                              >
                                {cellSession && (
                                  <div
                                    draggable={!cellSession.isLocked && !isOffMarker}
                                    onDragStart={e => handleDragStart(e, cellSession._id)}
                                    onClick={() => openEditModal(cellSession)}
                                    className={`SessionCard ${isDouble ? 'double-shift' : ''} ${
                                      isOffMarker ? 'off' : ''
                                    } ${isCancelled ? 'cancelled' : ''} ${
                                      isCompleted ? 'completed' : ''
                                    }`}
                                  >
                                    {isOffMarker ? (
                                      <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#b45309', whiteSpace: 'nowrap' }}>
                                        NGHỈ PHÉP (OFF)
                                      </span>
                                    ) : (
                                      <>
                                        <div className="SessionInfo">
                                          <span
                                            className="ClientTitle"
                                            style={{
                                              textDecoration: isCancelled ? 'line-through' : 'none'
                                            }}
                                          >
                                            {isDouble && (
                                              <span className="DoubleBadge">👥 Ca đôi</span>
                                            )}
                                            {getCleanSessionName(cellSession.clientName)}
                                          </span>
                                          <span className="TimePill">
                                            {cellSession.time || 'h'}
                                          </span>
                                        </div>

                                        {!cellSession.isLocked && (
                                          <button
                                            onClick={e => handleQuickToggleCancel(cellSession, e)}
                                            className="CancelBtn"
                                            title={isCancelled ? 'Khôi phục' : 'Gạch hủy ca'}
                                          >
                                            {isCancelled ? '↺' : '✕'}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* DÒNG CHỐT CA CUỐI BẢNG: HIỂN THỊ TỔNG CA (CA ĐÔI TÍNH LÀ 1) + NOTE SỐ CA ĐÔI */}
                      <tr className="FooterRow">
                        <td className="StickyCol" style={{ background: '#0f172a', color: '#fff' }}>
                          Chốt
                        </td>
                        {trainers.map(trainer => {
                          const validList = sessions.filter(
                            s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
                          );
                          const validCount = validList.length;
                          const doubleCount = validList.filter(s => isDoubleSession(s)).length;

                          return (
                            <td key={trainer._id}>
                              <div>
                                <span className="FooterCountBadge">{validCount}</span>
                              </div>
                              {doubleCount > 0 && (
                                <div className="FooterDoubleNote">
                                  📝 Có {doubleCount} ca đôi
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* CHẾ ĐỘ 2: THẺ THEO TỪNG PT */
                <div className="TrainerCardsGrid">
                  {trainers.map(trainer => {
                    const ptSessions = getSortedTrainerSessions(trainer._id);
                    const validList = ptSessions.filter(s => s.status !== 'CANCELLED');
                    const validCount = validList.length;
                    const doubleCount = validList.filter(s => isDoubleSession(s)).length;
                    const isOff = ptSessions.some(s => s.clientName === 'OFF');

                    return (
                      <div key={trainer._id} className="PTCard">
                        <div className="PTCardHeader">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '15px' }}>{trainer.name}</strong>
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#166534',
                                padding: '2px 9px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 800
                              }}
                            >
                              Chốt: {validCount} ca
                            </span>
                            {doubleCount > 0 && (
                              <span
                                style={{
                                  background: '#ede9fe',
                                  color: '#6d28d9',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11.5px',
                                  fontWeight: 800
                                }}
                              >
                                📝 Có {doubleCount} ca đôi
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => openQuickAddForTrainer(trainer._id)}
                              className="MiniTagBtn"
                              style={{ background: '#2563eb', color: '#fff' }}
                            >
                              + Ca
                            </button>
                            <button
                              onClick={() => handleToggleTrainerOff(trainer._id)}
                              className="MiniTagBtn"
                              style={{
                                background: isOff ? '#f59e0b' : '#f1f5f9',
                                color: isOff ? '#fff' : '#475569'
                              }}
                            >
                              OFF
                            </button>
                          </div>
                        </div>

                        {ptSessions.length === 0 ? (
                          <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>
                            Chưa có lịch tập hôm nay
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {ptSessions.map((cellSession, idx) => {
                              const isOffMarker = cellSession.clientName === 'OFF';
                              const isCancelled = cellSession.status === 'CANCELLED' && !isOffMarker;
                              const isDouble = isDoubleSession(cellSession);
                              return (
                                <div
                                  key={cellSession._id}
                                  onClick={() => openEditModal(cellSession)}
                                  className={`SessionCard ${isDouble ? 'double-shift' : ''} ${
                                    isOffMarker ? 'off' : ''
                                  } ${isCancelled ? 'cancelled' : ''}`}
                                >
                                  {isOffMarker ? (
                                    <span style={{ fontWeight: 800, color: '#b45309', fontSize: '12px' }}>
                                      NGHỈ PHÉP (OFF)
                                    </span>
                                  ) : (
                                    <>
                                      <div className="SessionInfo">
                                        <span
                                          className="ClientTitle"
                                          style={{
                                            textDecoration: isCancelled ? 'line-through' : 'none'
                                          }}
                                        >
                                          #{idx + 1}.{' '}
                                          {isDouble && (
                                            <span className="DoubleBadge">👥 Ca đôi</span>
                                          )}
                                          {getCleanSessionName(cellSession.clientName)}
                                        </span>
                                        <span className="TimePill">{cellSession.time || 'h'}</span>
                                      </div>

                                      {!cellSession.isLocked && (
                                        <button
                                          onClick={e => handleQuickToggleCancel(cellSession, e)}
                                          className="CancelBtn"
                                        >
                                          {isCancelled ? '↺' : '✕'}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== TAB 2: QUẢN LÝ LỊCH TUẦN ==================== */}
      {activeTab === 'CLIENTS' && (
        <div className="MainArea">
          <div className="ToolbarCard" style={{ margin: '0 0 12px 0' }}>
            <div className="ToolSection" style={{ flex: 1 }}>
              <select
                value={filterTrainer}
                onChange={e => setFilterTrainer(e.target.value)}
                style={styles.input}
              >
                <option value="ALL">Tất cả PT ({clients.length} khách)</option>
                {trainers.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>

              <select
                value={sortClientMode}
                onChange={e => setSortClientMode(e.target.value)}
                style={styles.input}
              >
                <option value="DEFAULT">📑 Sắp xếp: Mặc định</option>
                <option value="RECENT">🕒 Sắp xếp: Mới chỉnh sửa gần nhất</option>
              </select>

              <input
                type="text"
                placeholder="🔍 Tìm tên khách hàng..."
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
                style={{ ...styles.input, flex: 1, minWidth: '180px' }}
              />
            </div>

            <button
              onClick={() =>
                setEditingClient({
                  name: '',
                  primaryTrainerId: trainers[0]?._id || '',
                  status: 'ACTIVE',
                  packageNote: '',
                  weeklySchedule: []
                })
              }
              className="Btn BtnBlue"
            >
              + Thêm Khách Mới
            </button>
          </div>

          <div className="ClientCardsGrid">
            {displayedClients.map(client => {
              const { cleanNote, updatedAt } = parseClientNoteAndTime(
                client.packageNote,
                client.updatedAt
              );
              const formattedTime = formatUpdateTime(updatedAt);

              return (
                <div key={client._id} className="ClientItemCard">
                  <div className="ClientCardTop">
                    <div>
                      <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>
                        {client.name}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                        PT Quản lý: <strong style={{ color: '#1e293b' }}>{client.primaryTrainerId?.name || '—'}</strong>
                      </div>
                    </div>

                    <span
                      className="StatusBadge"
                      style={{
                        background: client.status === 'ACTIVE' ? '#dcfce7' : '#fef3c7',
                        color: client.status === 'ACTIVE' ? '#166534' : '#92400e'
                      }}
                    >
                      {client.status === 'ACTIVE' ? '● Đang tập' : '⏸ Tạm nghỉ'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {client.weeklySchedule
                      ?.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                      .map((slot, idx) => (
                        <span key={idx} className="ScheduleTag">
                          T{slot.dayOfWeek}: {slot.time || 'Báo sau'}
                        </span>
                      ))}
                  </div>

                  {cleanNote && (
                    <div
                      style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#92400e',
                        fontWeight: 600
                      }}
                    >
                      📌 {cleanNote}
                    </div>
                  )}

                  {/* Dòng hiển thị thời gian chỉnh sửa lịch tuần */}
                  <div
                    className={`ModifiedTimeBox ${formattedTime ? 'edited' : 'unchanged'}`}
                    style={{ marginTop: 'auto' }}
                  >
                    <span>
                      {formattedTime
                        ? `🕒 Đã sửa: ${formattedTime}`
                        : '🕒 Chưa có lịch sử chỉnh sửa'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() =>
                        setEditingClient({
                          ...client,
                          packageNote: cleanNote,
                          lastModifiedDisplay: formattedTime,
                          primaryTrainerId: client.primaryTrainerId?._id || client.primaryTrainerId
                        })
                      }
                      className="Btn BtnLight"
                      style={{ width: '100%' }}
                    >
                      ✏️ Chỉnh Sửa Lịch Tuần
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: TỔNG HỢP & DỌN DẸP THEO THÁNG ==================== */}
      {activeTab === 'SUMMARY' && (
        <div className="MainArea">
          {/* Thanh chọn theo Tháng (VD: Tháng 11/2026) để Xuất Excel hoặc Xóa Sạch Cuối Tháng */}
          <div
            className="ToolbarCard"
            style={{
              margin: '0 0 12px 0',
              background: '#f8fafc',
              border: '1px solid #cbd5e1'
            }}
          >
            <div className="ToolSection">
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                🗓 Quản lý theo Tháng:
              </span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => handleSelectFullMonth(e.target.value)}
                style={{ ...styles.input, fontWeight: 700 }}
              />
              <button
                onClick={() => handleSelectFullMonth(selectedMonth)}
                className="Btn BtnDark"
              >
                📅 Xem Cả {currentMonthInfo.label}
              </button>
            </div>

            <div className="ToolSection">
              <button onClick={exportWeeklyToExcel} className="Btn BtnEmerald">
                📥 Xuất Excel ({startDate.slice(5)} → {endDate.slice(5)})
              </button>

              <button onClick={handleDeleteMonthSessions} className="Btn BtnRed">
                🗑 Xóa Chốt Ca {currentMonthInfo.label}
              </button>
            </div>
          </div>

          {/* Thanh lọc tùy chỉnh từ ngày đến ngày */}
          <div className="ToolbarCard" style={{ margin: '0 0 12px 0' }}>
            <div className="ToolSection">
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Từ ngày:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Đến ngày:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} />
              <button onClick={() => loadWeeklySummary(startDate, endDate)} className="Btn BtnBlue">
                🔍 Lọc Theo Ngày
              </button>
            </div>
          </div>

          <div className="ClientCardsGrid">
            {trainers.map(trainer => {
              const item = weeklySummary.find(w => w._id === trainer._id);
              const totalDouble = item?.totalDoubleShifts || 0;
              return (
                <div key={trainer._id} className="ClientItemCard">
                  <div className="ClientCardTop">
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>{trainer.name}</strong>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {totalDouble > 0 && (
                        <span
                          className="StatusBadge"
                          style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '12px' }}
                        >
                          📝 Có {totalDouble} ca đôi
                        </span>
                      )}
                      <span
                        className="StatusBadge"
                        style={{ background: '#0f172a', color: '#4ade80', fontSize: '13px' }}
                      >
                        Tổng: {item ? item.totalShifts : 0} ca
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item?.dailyBreakdown?.map((d, i) => (
                      <span key={i} className="ScheduleTag">
                        Ngày {d.date.slice(5)}: {d.count} ca
                        {d.doubleCount ? ` (có ${d.doubleCount} ca đôi)` : ''}
                      </span>
                    )) || (
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                        Chưa có ngày chốt ca trong khoảng này
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== MODAL XẾP LẠI LỊCH (CÓ TÍCH CA ĐÔI & GỘP CA) ==================== */}
      {editingSession && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleSaveReschedule} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>
              Xếp Lại Ca: {getCleanSessionName(editingSession.clientName)}
            </h3>

            <label style={styles.fieldGroup}>
              <span>Tên khách hiển thị:</span>
              <input
                type="text"
                value={editForm.clientName}
                onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                style={styles.input}
              />
            </label>

            {/* Khung bật/tắt Ca Đôi (tính 1 ca, ghi chú ở Chốt ca) */}
            <div
              style={{
                background: editForm.isDouble ? '#f5f3ff' : '#f8fafc',
                border: editForm.isDouble ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                padding: '10px 12px',
                borderRadius: '10px',
                marginBottom: '12px'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  color: editForm.isDouble ? '#6d28d9' : '#1e293b',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={editForm.isDouble}
                  onChange={e => setEditForm({ ...editForm, isDouble: e.target.checked })}
                />
                👥 Đánh dấu là Ca Đôi (Tập 2 người — Tính 1 ca & ghi note ở Chốt ca)
              </label>

              {editForm.isDouble && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ ...styles.fieldGroup, marginBottom: 0 }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>
                      🔗 Gộp chung với 1 ca khác trong ngày của PT này (sẽ gộp thành 1 ca):
                    </span>
                    <select
                      value={editForm.mergeWithSessionId}
                      onChange={e => setEditForm({ ...editForm, mergeWithSessionId: e.target.value })}
                      style={styles.input}
                    >
                      <option value="">-- Không gộp (hoặc tự nhập tên khách thứ 2 ở dưới) --</option>
                      {sessions
                        .filter(
                          s =>
                            s._id !== editingSession._id &&
                            s.trainerId === editForm.trainerId &&
                            s.clientName !== 'OFF'
                        )
                        .map(s => (
                          <option key={s._id} value={s._id}>
                            Gộp với: {getCleanSessionName(s.clientName)} ({s.time || 'h'})
                          </option>
                        ))}
                    </select>
                  </label>

                  {!editForm.mergeWithSessionId && (
                    <label style={{ ...styles.fieldGroup, marginBottom: 0 }}>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        Hoặc nhập/chọn thêm tên khách thứ 2 tập cùng:
                      </span>
                      <input
                        type="text"
                        placeholder="VD: Khánh trinh (bỏ trống nếu tên trên đã có đủ 2 người)"
                        value={editForm.secondClientName}
                        onChange={e => setEditForm({ ...editForm, secondClientName: e.target.value })}
                        style={styles.input}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <label style={styles.fieldGroup}>
              <span>Giờ tập (VD: 7h30, 15h, 18h45):</span>
              <input
                type="text"
                value={editForm.time}
                onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                style={styles.input}
              />
            </label>

            <label style={styles.fieldGroup}>
              <span>PT phụ trách:</span>
              <select
                value={editForm.trainerId}
                onChange={e => setEditForm({ ...editForm, trainerId: e.target.value })}
                style={styles.input}
              >
                {trainers.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span>Trạng thái ca:</span>
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                style={styles.input}
              >
                <option value="SCHEDULED">Đang hoạt động (Tính vào chốt ca)</option>
                <option value="CANCELLED">Gạch ngang - Khách báo hủy (Không tính ca)</option>
              </select>
            </label>

            <div style={styles.scopePanel}>
              <strong>Phạm vi áp dụng:</strong>
              <label style={styles.radioRow}>
                <input
                  type="radio"
                  checked={editForm.updateScope === 'DAILY'}
                  onChange={() => setEditForm({ ...editForm, updateScope: 'DAILY' })}
                />
                Chỉ áp dụng cho ngày {selectedDate}
              </label>
              <label style={styles.radioRow}>
                <input
                  type="radio"
                  checked={editForm.updateScope === 'WEEKLY'}
                  onChange={() => setEditForm({ ...editForm, updateScope: 'WEEKLY' })}
                />
                Lưu cố định vào Lịch Tuần cho các tuần tiếp theo
              </label>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={handleDeleteSession}
                className="Btn"
                style={{ background: '#e11d48', color: '#fff' }}
              >
                🗑 Xóa ca
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditingSession(null)} className="Btn BtnLight">
                  Đóng
                </button>
                <button type="submit" className="Btn BtnBlue">
                  Lưu Lại
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL THÊM CA TẬP (HỖ TRỢ XẾP CA ĐÔI) ==================== */}
      {showAddModal && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleAddSession} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Thêm Ca Tập ({selectedDate})</h3>

            {/* Nút tích chọn Ca Đôi */}
            <div
              style={{
                background: addForm.isDouble ? '#f5f3ff' : '#f8fafc',
                border: addForm.isDouble ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                padding: '10px 12px',
                borderRadius: '10px',
                marginBottom: '12px'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '13px',
                  color: addForm.isDouble ? '#6d28d9' : '#1e293b',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={addForm.isDouble}
                  onChange={e => setAddForm({ ...addForm, isDouble: e.target.checked })}
                />
                👥 Xếp Ca Đôi (2 khách tập chung — Tính 1 ca & ghi note ở Chốt ca)
              </label>
            </div>

            <label style={styles.fieldGroup}>
              <span>{addForm.isDouble ? 'Chọn khách thứ 1:' : 'Chọn khách có sẵn (hoặc nhập tên mới):'}</span>
              <select
                value={addForm.clientId}
                onChange={e => {
                  const found = clients.find(c => c._id === e.target.value);
                  setAddForm({
                    ...addForm,
                    clientId: e.target.value,
                    clientName: found ? found.name : addForm.clientName,
                    trainerId: found?.primaryTrainerId?._id || addForm.trainerId
                  });
                }}
                style={styles.input}
              >
                <option value="">-- Nhập tên khách mới --</option>
                {clients.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span>{addForm.isDouble ? 'Tên khách thứ 1:' : 'Tên khách hàng:'}</span>
              <input
                type="text"
                required
                placeholder="VD: a Cường"
                value={addForm.clientName}
                onChange={e => setAddForm({ ...addForm, clientName: e.target.value })}
                style={styles.input}
              />
            </label>

            {/* Nếu bật Ca Đôi thì hiện thêm ô chọn/nhập Khách thứ 2 */}
            {addForm.isDouble && (
              <div
                style={{
                  background: '#faf5ff',
                  border: '1px dashed #a855f7',
                  padding: '10px',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}
              >
                <label style={styles.fieldGroup}>
                  <span>Chọn khách thứ 2 tập cùng (tùy chọn):</span>
                  <select
                    value={addForm.secondClientId}
                    onChange={e => {
                      const found2 = clients.find(c => c._id === e.target.value);
                      setAddForm({
                        ...addForm,
                        secondClientId: e.target.value,
                        secondClientName: found2 ? found2.name : addForm.secondClientName
                      });
                    }}
                    style={styles.input}
                  >
                    <option value="">-- Tự gõ tên khách thứ 2 ở dưới --</option>
                    {clients.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </label>

                <label style={{ ...styles.fieldGroup, marginBottom: 0 }}>
                  <span>Tên khách thứ 2 tập cùng:</span>
                  <input
                    type="text"
                    placeholder="VD: Khánh trinh"
                    value={addForm.secondClientName}
                    onChange={e => setAddForm({ ...addForm, secondClientName: e.target.value })}
                    style={styles.input}
                  />
                </label>
              </div>
            )}

            <label style={styles.fieldGroup}>
              <span>PT đứng lớp:</span>
              <select
                value={addForm.trainerId}
                onChange={e => setAddForm({ ...addForm, trainerId: e.target.value })}
                style={styles.input}
              >
                {trainers.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span>Giờ tập (VD: 8h30, 16h, 19h):</span>
              <input
                type="text"
                value={addForm.time}
                onChange={e => setAddForm({ ...addForm, time: e.target.value })}
                style={styles.input}
              />
            </label>

            {addForm.clientId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginTop: '6px' }}>
                <input
                  type="checkbox"
                  checked={addForm.saveToWeekly}
                  onChange={e => setAddForm({ ...addForm, saveToWeekly: e.target.checked })}
                />
                Lưu cố định thứ này vào Lịch Tuần của khách
              </label>
            )}

            <div style={{ ...styles.modalFooter, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="Btn BtnLight">
                Hủy
              </button>
              <button type="submit" className="Btn BtnBlue">
                {addForm.isDouble ? '👥 Thêm Ca Đôi' : 'Thêm Vào Lịch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL SỬA LỊCH TUẦN KHÁCH HÀNG ==================== */}
      {editingClient && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, width: '500px' }}>
            <h3 style={{ ...styles.modalTitle, marginBottom: '6px' }}>
              {editingClient._id ? `Lịch Tuần: ${editingClient.name}` : 'Thêm Khách Hàng Mới'}
            </h3>

            {editingClient.lastModifiedDisplay && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#15803d',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontWeight: 600
                }}
              >
                🕒 Lần chỉnh sửa gần nhất: {editingClient.lastModifiedDisplay}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={styles.fieldGroup}>
                <span>Tên khách hàng:</span>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.fieldGroup}>
                <span>PT phụ trách chính:</span>
                <select
                  value={editingClient.primaryTrainerId}
                  onChange={e => setEditingClient({ ...editingClient, primaryTrainerId: e.target.value })}
                  style={styles.input}
                >
                  {trainers.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={styles.fieldGroup}>
                <span>Trạng thái:</span>
                <select
                  value={editingClient.status}
                  onChange={e => setEditingClient({ ...editingClient, status: e.target.value })}
                  style={styles.input}
                >
                  <option value="ACTIVE">Đang tập</option>
                  <option value="PAUSED">Tạm nghỉ (Off 1 tuần)</option>
                </select>
              </label>

              <label style={styles.fieldGroup}>
                <span>Ghi chú gói tập:</span>
                <input
                  type="text"
                  value={editingClient.packageNote || ''}
                  onChange={e => setEditingClient({ ...editingClient, packageNote: e.target.value })}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={{ marginTop: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Các buổi tập cố định trong tuần:</strong>
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {DAYS.map(day => {
                  const slot = editingClient.weeklySchedule.find(s => s.dayOfWeek === day.num);
                  const isChecked = Boolean(slot);
                  return (
                    <div
                      key={day.num}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        borderRadius: '8px'
                      }}
                    >
                      <label style={{ width: '85px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditingClient({
                                ...editingClient,
                                weeklySchedule: [
                                  ...editingClient.weeklySchedule,
                                  { dayOfWeek: day.num, time: '9h', assignedTrainerId: editingClient.primaryTrainerId }
                                ]
                              });
                            } else {
                              setEditingClient({
                                ...editingClient,
                                weeklySchedule: editingClient.weeklySchedule.filter(s => s.dayOfWeek !== day.num)
                              });
                            }
                          }}
                        />{' '}
                        {day.label}
                      </label>

                      {isChecked && (
                        <>
                          <input
                            type="text"
                            placeholder="Giờ"
                            value={slot.time}
                            onChange={e =>
                              setEditingClient({
                                ...editingClient,
                                weeklySchedule: editingClient.weeklySchedule.map(s =>
                                  s.dayOfWeek === day.num ? { ...s, time: e.target.value } : s
                                )
                              })
                            }
                            style={{ ...styles.input, width: '95px' }}
                          />
                          <select
                            value={slot.assignedTrainerId || editingClient.primaryTrainerId}
                            onChange={e =>
                              setEditingClient({
                                ...editingClient,
                                weeklySchedule: editingClient.weeklySchedule.map(s =>
                                  s.dayOfWeek === day.num ? { ...s, assignedTrainerId: e.target.value } : s
                                )
                              })
                            }
                            style={{ ...styles.input, flex: 1 }}
                          >
                            {trainers.map(t => (
                              <option key={t._id} value={t._id}>PT: {t.name}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...styles.modalFooter, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingClient(null)} className="Btn BtnLight">
                Đóng
              </button>
              <button
                onClick={async () => {
                  if (editingClient._id) {
                    await handleSaveClientWeekly();
                  } else {
                    const payload = {
                      ...editingClient,
                      packageNote: attachUpdateTimestamp(editingClient.packageNote)
                    };
                    const res = await axios.post(`${API_URL}/clients`, payload);
                    setClients([...clients, res.data]);
                    setEditingClient(null);
                  }
                }}
                className="Btn BtnBlue"
              >
                Lưu Lịch Tuần
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  input: { padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', color: '#0f172a' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '12px' },
  modalCard: { background: '#fff', color: '#0f172a', padding: '20px', borderRadius: '14px', width: '440px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.25)', textAlign: 'left' },
  modalTitle: { marginTop: 0, marginBottom: '14px', fontSize: '16.5px', fontWeight: 800, color: '#0f172a' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#1e293b' },
  scopePanel: { background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginTop: '4px', color: '#1e293b' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', gap: '8px' }
};
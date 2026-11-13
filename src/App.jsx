// Tệp: frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

// Đã gắn sẵn đường dẫn Render của bạn
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

// Lấy đúng ngày hiện tại theo giờ địa phương (YYYY-MM-DD)
function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Tự động tính Thứ 2 đầu tuần và Chủ Nhật cuối tuần của tuần hiện tại
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 (CN) -> 6 (T7)
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
  const [trainers, setTrainers] = useState([]);
  const [clients, setClients] = useState([]);
  // Tự động lấy ngày hôm nay ngay khi vào web
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [sessions, setSessions] = useState([]);
  const [autoSortTime, setAutoSortTime] = useState(true);

  // Chế độ hiển thị Full khung (fitScreen = true giúp gom tất cả cột vừa khít màn hình)
  const [fitScreen, setFitScreen] = useState(true);
  const [isFullscreenBoard, setIsFullscreenBoard] = useState(false);

  const [editingSession, setEditingSession] = useState(null);
  const [editForm, setEditForm] = useState({
    trainerId: '',
    time: '',
    clientName: '',
    status: 'SCHEDULED',
    updateScope: 'DAILY'
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    trainerId: '',
    clientId: '',
    clientName: '',
    time: '',
    saveToWeekly: false
  });

  const [filterTrainer, setFilterTrainer] = useState('ALL');
  const [searchClient, setSearchClient] = useState('');
  const [editingClient, setEditingClient] = useState(null);

  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [weeklySummary, setWeeklySummary] = useState([]);

  useEffect(() => {
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

  // Chuyển nhanh ngày hôm trước / hôm sau
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
    return `Lịch PT (${dayLabel} - ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y})`;
  };

  const exportDailyToExcel = () => {
    const aoa = [];
    aoa.push([formatHeaderDate(selectedDate)]);
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
          const timeLabel = s.time ? ` (${s.time})` : '';
          const cancelPrefix = s.status === 'CANCELLED' ? '[HỦY] ' : '';
          rowData.push(`${cancelPrefix}${s.clientName}${timeLabel}`);
        }
      });
      aoa.push(rowData);
    }

    const footerRow = ['Chốt ca'];
    trainers.forEach(trainer => {
      const validCount = sessions.filter(
        s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
      ).length;
      footerRow.push(validCount);
    });
    aoa.push(footerRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, ...trainers.map(() => ({ wch: 22 }))];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: trainers.length } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lich_PT_${selectedDate}`);
    XLSX.writeFile(wb, `Lich_PT_${selectedDate}.xlsx`);
  };

  const exportWeeklyToExcel = () => {
    const aoa = [
      [`BÁO CÁO TỔNG HỢP CA PT (${startDate} đến ${endDate})`],
      ['Huấn Luyện Viên (PT)', 'Chi Tiết Các Ngày Đã Chốt', 'Tổng Số Ca Tuần']
    ];

    trainers.forEach(trainer => {
      const item = weeklySummary.find(w => w._id === trainer._id);
      const detailStr =
        item?.dailyBreakdown?.map(d => `${d.date.slice(5)}: ${d.count} ca`).join(', ') ||
        'Chưa có ca chốt';
      aoa.push([trainer.name, detailStr, item ? item.totalShifts : 0]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 16 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tong_Hop_Tuan');
    XLSX.writeFile(wb, `Tong_Hop_Ca_PT_${startDate}_den_${endDate}.xlsx`);
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
      clientName: session.clientName,
      status: session.status,
      updateScope: 'DAILY'
    });
  };

  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    const res = await axios.put(`${API_URL}/daily-session/${editingSession._id}/reschedule`, editForm);
    setSessions(sessions.map(s => (s._id === editingSession._id ? res.data : s)));
    if (editForm.updateScope === 'WEEKLY') fetchInitData();
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
      time: '15h',
      saveToWeekly: false
    });
    setShowAddModal(true);
  };

  const handleAddSession = async (e) => {
    e.preventDefault();
    const res = await axios.post(`${API_URL}/daily-session/add`, {
      date: selectedDate,
      ...addForm
    });
    setSessions([...sessions, res.data]);
    if (addForm.saveToWeekly) fetchInitData();
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
    const res = await axios.put(`${API_URL}/clients/${editingClient._id}`, editingClient);
    setClients(clients.map(c => (c._id === editingClient._id ? res.data : c)));
    setEditingClient(null);
  };

  const loadWeeklySummary = async () => {
    const res = await axios.get(`${API_URL}/weekly-summary`, {
      params: { startDate, endDate }
    });
    setWeeklySummary(res.data);
  };

  const isDayLocked = sessions.some(s => s.isLocked);
  const totalValidShifts = sessions.filter(s => s.status !== 'CANCELLED').length;
  const totalCancelledShifts = sessions.filter(
    s => s.status === 'CANCELLED' && s.clientName !== 'OFF'
  ).length;

  return (
    <div className="app-wrapper">
      {/* CSS Responsive tối ưu hiển thị Full Bảng trên cả Điện Thoại và Máy Tính */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Inter', 'Segoe UI', sans-serif; color: #0f172a; }
        .app-wrapper { min-height: 100vh; display: flex; flex-direction: column; }

        /* Thanh Header gọn gàng */
        .top-header {
          background: #0f172a; color: #fff; padding: 8px 14px;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 8px;
        }
        .brand-box { display: flex; align-items: center; gap: 10px; }
        .logo-badge {
          width: 32px; height: 32px; border-radius: 8px; background: #3b82f6;
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;
        }
        .brand-title { margin: 0; font-size: 15px; font-weight: 700; }
        .nav-tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.1); padding: 3px; border-radius: 8px; }
        .tab-btn {
          border: none; background: transparent; color: #cbd5e1; padding: 6px 10px;
          border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .tab-btn.active { background: #3b82f6; color: #fff; }

        /* Thanh công cụ mỏng gọn */
        .compact-toolbar {
          background: #fff; padding: 8px 12px; border-bottom: 1px solid #cbd5e1;
          display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
        }
        .tool-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .btn {
          border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px;
          font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
        }
        .btn-blue { background: #2563eb; color: #fff; }
        .btn-gray { background: #e2e8f0; color: #1e293b; }
        .btn-green { background: #16a34a; color: #fff; }
        .btn-emerald { background: #059669; color: #fff; }
        .btn-orange { background: #ea580c; color: #fff; }
        .btn-dark { background: #1e293b; color: #fff; }

        .date-nav {
          display: flex; align-items: center; gap: 4px; background: #f8fafc;
          border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 4px;
        }
        .date-input {
          border: none; background: transparent; font-size: 12.5px; font-weight: 700;
          color: #0f172a; outline: none; width: 112px;
        }

        /* Bảng Lịch Chính */
        .board-container { flex: 1; padding: 6px; overflow-x: auto; }
        .schedule-banner {
          background: #fef08a; border: 1px solid #eab308; border-bottom: none;
          padding: 6px 12px; display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 6px; border-radius: 8px 8px 0 0; font-size: 13.5px; font-weight: 800;
        }
        .summary-pills { display: flex; gap: 8px; font-size: 12px; font-weight: 700; align-items: center; }

        .pt-table {
          width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #94a3b8;
        }
        .pt-table.fit-mode { table-layout: fixed; }
        .pt-table.scroll-mode { table-layout: auto; min-width: 980px; }

        .pt-table th, .pt-table td {
          border: 1px solid #cbd5e1; padding: 4px 5px; vertical-align: middle;
          word-break: break-word; overflow-wrap: anywhere;
        }
        .col-index { width: 32px; text-align: center; font-weight: 700; font-size: 12px; background: #fef9c3; }
        .th-trainer { background: #fef9c3; text-align: center; padding: 6px 4px !important; }
        .trainer-title { font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 4px; }
        .trainer-btns { display: flex; justify-content: center; gap: 3px; flex-wrap: wrap; }
        .mini-btn {
          border: none; border-radius: 4px; padding: 2px 5px; font-size: 10px;
          font-weight: 700; cursor: pointer;
        }

        /* Thẻ khách trong từng ô: tự động xuống dòng, không bao giờ mất chữ */
        .cell-chip {
          display: flex; justify-content: space-between; align-items: center;
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px;
          padding: 3px 5px; cursor: pointer; gap: 3px; min-height: 28px;
        }
        .cell-chip.cancelled { background: #f1f5f9; border-color: #cbd5e1; opacity: 0.7; }
        .cell-chip.completed { background: #ecfdf5; border-color: #6ee7b7; }
        .cell-chip.off { background: #fef3c7; border-color: #fcd34d; justify-content: center; }

        .chip-text {
          font-size: 12.5px; font-weight: 600; color: #0f172a; line-height: 1.25;
          text-align: left; flex: 1;
        }
        .chip-time {
          color: #1d4ed8; font-weight: 800; font-size: 11.5px; margin-left: 3px;
        }
        .strike-x {
          border: none; background: transparent; color: #94a3b8; font-size: 11px;
          padding: 0 2px; cursor: pointer; flex-shrink: 0;
        }

        .footer-row { background: #0f172a; color: #fff; font-weight: 800; text-align: center; }
        .footer-badge {
          display: inline-block; background: #22c55e; color: #fff;
          font-size: 13px; font-weight: 800; padding: 2px 8px; border-radius: 12px;
        }

        /* Tối ưu riêng cho màn hình Điện Thoại */
        @media (max-width: 768px) {
          .top-header { padding: 6px 8px; }
          .brand-title { font-size: 13px; }
          .tab-btn { padding: 5px 7px; font-size: 11px; }
          .compact-toolbar { padding: 6px 8px; gap: 5px; }
          .btn { padding: 5px 7px; font-size: 11px; }
          .board-container { padding: 2px; }
          .schedule-banner { padding: 5px 8px; font-size: 12px; }

          .col-index { width: 22px; font-size: 10px; padding: 2px !important; }
          .pt-table th, .pt-table td { padding: 2px 2px !important; }
          .trainer-title { font-size: 10.5px; margin-bottom: 2px; }
          .mini-btn { font-size: 8.5px; padding: 1px 3px; }
          .cell-chip { padding: 2px 3px; min-height: 24px; border-radius: 4px; }
          .chip-text { font-size: 10px; line-height: 1.15; }
          .chip-time { font-size: 9.5px; margin-left: 2px; }
          .strike-x { font-size: 9px; padding: 0; }
          .footer-badge { font-size: 11px; padding: 1px 5px; }
        }
      `}</style>

      {/* Ẩn Header khi bật chế độ Full Màn Hình Bảng Lịch */}
      {!isFullscreenBoard && (
        <header className="top-header">
          <div className="brand-box">
            <div className="logo-badge">LN</div>
            <h1 className="brand-title">LN TRAINING — LỊCH & CHỐT CA PT</h1>
          </div>

          <div className="nav-tabs">
            <button
              onClick={() => setActiveTab('DAILY')}
              className={`tab-btn ${activeTab === 'DAILY' ? 'active' : ''}`}
            >
              📅 Lịch Ngày
            </button>
            <button
              onClick={() => setActiveTab('CLIENTS')}
              className={`tab-btn ${activeTab === 'CLIENTS' ? 'active' : ''}`}
            >
              👥 Lịch Tuần ({clients.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('SUMMARY');
                loadWeeklySummary();
              }}
              className={`tab-btn ${activeTab === 'SUMMARY' ? 'active' : ''}`}
            >
              📊 Tổng Hợp Tuần
            </button>
          </div>
        </header>
      )}

      {/* ==================== TAB 1: BẢNG LỊCH MỖI NGÀY ==================== */}
      {activeTab === 'DAILY' && (
        <>
          {!isFullscreenBoard && (
            <div className="compact-toolbar">
              <div className="tool-group">
                {/* Bộ chọn ngày + Nút Hôm nay */}
                <div className="date-nav">
                  <button onClick={() => changeDayBy(-1)} className="btn btn-gray" title="Hôm trước">
                    ◀
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="date-input"
                  />
                  <button onClick={() => changeDayBy(1)} className="btn btn-gray" title="Hôm sau">
                    ▶
                  </button>
                  <button
                    onClick={() => setSelectedDate(getTodayStr())}
                    className="btn btn-blue"
                    style={{ padding: '4px 7px', fontSize: '11px' }}
                  >
                    Hôm nay
                  </button>
                </div>

                <button
                  onClick={() => openQuickAddForTrainer(trainers[0]?._id || '')}
                  className="btn btn-blue"
                >
                  + Thêm Ca
                </button>

                <button onClick={handleResyncFromWeekly} className="btn btn-gray">
                  🔄 Đồng Bộ Tuần
                </button>
              </div>

              <div className="tool-group">
                {/* Nút chuyển đổi giữa Vừa Khít Màn Hình và Cuộn Ngang */}
                <button
                  onClick={() => setFitScreen(!fitScreen)}
                  className="btn btn-dark"
                  title="Thu gọn tất cả cột vừa khít màn hình hoặc mở rộng để cuộn ngang"
                >
                  {fitScreen ? '↔️ Mở Rộng Cột' : '📐 Vừa Khít Màn Hình'}
                </button>

                <button onClick={exportDailyToExcel} className="btn btn-emerald">
                  📥 Xuất Excel
                </button>

                {!isDayLocked ? (
                  <button onClick={handleCloseDay} className="btn btn-green">
                    ✅ Chốt Ca
                  </button>
                ) : (
                  <button onClick={handleReopenDay} className="btn btn-orange">
                    🔓 Mở Khóa
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Khung Bảng Xếp Lịch Full Màn Hình */}
          <div className="board-container">
            <div className="schedule-banner">
              <span>{formatHeaderDate(selectedDate)}</span>

              <div className="summary-pills">
                <span style={{ color: '#1d4ed8' }}>Tổng chốt: {totalValidShifts} ca</span>
                <span>•</span>
                <span style={{ color: '#e11d48' }}>Hủy: {totalCancelledShifts}</span>
                <span>•</span>
                <span style={{ color: isDayLocked ? '#16a34a' : '#b45309' }}>
                  {isDayLocked ? '🔒 Đã chốt' : '🔓 Đang mở'}
                </span>

                <button
                  onClick={() => setIsFullscreenBoard(!isFullscreenBoard)}
                  className="btn btn-dark"
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  {isFullscreenBoard ? '✕ Thoát Full' : '⛶ Full Màn Hình'}
                </button>
              </div>
            </div>

            <table className={`pt-table ${fitScreen ? 'fit-mode' : 'scroll-mode'}`}>
              <thead>
                <tr>
                  <th className="col-index">Ca</th>
                  {trainers.map(trainer => {
                    const isOff = sessions.some(
                      s => s.trainerId === trainer._id && s.clientName === 'OFF'
                    );
                    return (
                      <th key={trainer._id} className="th-trainer">
                        <div className="trainer-title">{trainer.name}</div>
                        <div className="trainer-btns">
                          <button
                            onClick={() => openQuickAddForTrainer(trainer._id)}
                            className="mini-btn"
                            style={{ background: '#2563eb', color: '#fff' }}
                          >
                            +Ca
                          </button>
                          <button
                            onClick={() => handleToggleTrainerOff(trainer._id)}
                            className="mini-btn"
                            style={{
                              background: isOff ? '#f59e0b' : '#fff',
                              color: isOff ? '#fff' : '#475569',
                              border: '1px solid #94a3b8'
                            }}
                          >
                            OFF
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
                    <td className="col-index" style={{ background: '#f8fafc', color: '#64748b' }}>
                      {rowIndex + 1}
                    </td>

                    {trainers.map(trainer => {
                      const trainerSessions = getSortedTrainerSessions(trainer._id);
                      const cellSession = trainerSessions[rowIndex];
                      const isOffMarker = cellSession?.clientName === 'OFF';
                      const isCancelled = cellSession?.status === 'CANCELLED' && !isOffMarker;
                      const isCompleted = cellSession?.status === 'COMPLETED';

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
                              className={`cell-chip ${isOffMarker ? 'off' : ''} ${
                                isCancelled ? 'cancelled' : ''
                              } ${isCompleted ? 'completed' : ''}`}
                            >
                              {isOffMarker ? (
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>
                                  OFF
                                </span>
                              ) : (
                                <>
                                  <div
                                    className="chip-text"
                                    style={{
                                      textDecoration: isCancelled ? 'line-through' : 'none'
                                    }}
                                  >
                                    {cellSession.clientName}
                                    <span className="chip-time">
                                      ({cellSession.time || 'h'})
                                    </span>
                                  </div>

                                  {!cellSession.isLocked && (
                                    <button
                                      onClick={e => handleQuickToggleCancel(cellSession, e)}
                                      className="strike-x"
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

                {/* Dòng Chốt Ca Cuối Bảng */}
                <tr className="footer-row">
                  <td style={{ fontSize: '11px', padding: '6px 2px' }}>Chốt</td>
                  {trainers.map(trainer => {
                    const validCount = sessions.filter(
                      s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
                    ).length;
                    return (
                      <td key={trainer._id} style={{ padding: '6px 2px' }}>
                        <span className="footer-badge">{validCount}</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================== TAB 2: QUẢN LÝ LỊCH TUẦN ==================== */}
      {activeTab === 'CLIENTS' && (
        <div style={{ padding: '10px' }}>
          <div className="compact-toolbar" style={{ borderRadius: '8px', marginBottom: '10px' }}>
            <div className="tool-group">
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

              <input
                type="text"
                placeholder="🔍 Tìm tên khách..."
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
                style={{ ...styles.input, width: '200px' }}
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
              className="btn btn-blue"
            >
              + Thêm Khách Mới
            </button>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <table className="pt-table">
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Khách Hàng</th>
                  <th style={{ padding: '8px' }}>PT Quản Lý</th>
                  <th style={{ padding: '8px' }}>Trạng Thái</th>
                  <th style={{ padding: '8px' }}>Lịch Tập Cố Định</th>
                  <th style={{ padding: '8px' }}>Ghi Chú</th>
                  <th style={{ padding: '8px' }}>Sửa</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter(c => filterTrainer === 'ALL' || (c.primaryTrainerId?._id || c.primaryTrainerId) === filterTrainer)
                  .filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()))
                  .map(client => (
                    <tr key={client._id}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{client.name}</td>
                      <td style={{ padding: '8px' }}>{client.primaryTrainerId?.name || '—'}</td>
                      <td style={{ padding: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: client.status === 'ACTIVE' ? '#dcfce7' : '#fef3c7',
                            color: client.status === 'ACTIVE' ? '#166534' : '#92400e'
                          }}
                        >
                          {client.status === 'ACTIVE' ? 'Đang tập' : 'Tạm nghỉ'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {client.weeklySchedule
                            ?.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                            .map((slot, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 700
                                }}
                              >
                                T{slot.dayOfWeek}: {slot.time || 'báo sau'}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{client.packageNote}</td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() =>
                            setEditingClient({
                              ...client,
                              primaryTrainerId: client.primaryTrainerId?._id || client.primaryTrainerId
                            })
                          }
                          className="btn btn-gray"
                        >
                          ✏️ Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: TỔNG HỢP CUỐI TUẦN ==================== */}
      {activeTab === 'SUMMARY' && (
        <div style={{ padding: '10px' }}>
          <div className="compact-toolbar" style={{ borderRadius: '8px', marginBottom: '10px' }}>
            <div className="tool-group">
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Từ:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} />
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Đến:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} />
              <button onClick={loadWeeklySummary} className="btn btn-blue">
                🔍 Xem Tổng Hợp
              </button>
            </div>

            <button onClick={exportWeeklyToExcel} className="btn btn-emerald">
              📥 Xuất Excel Tuần
            </button>
          </div>

          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <table className="pt-table">
              <thead>
                <tr style={{ background: '#fef08a', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Huấn Luyện Viên (PT)</th>
                  <th style={{ padding: '10px' }}>Chi Tiết Các Ngày Đã Chốt</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Tổng Ca Tuần</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map(trainer => {
                  const item = weeklySummary.find(w => w._id === trainer._id);
                  return (
                    <tr key={trainer._id}>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{trainer.name}</td>
                      <td style={{ padding: '10px' }}>
                        {item?.dailyBreakdown?.map((d, i) => (
                          <span
                            key={i}
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              marginRight: '6px',
                              display: 'inline-block',
                              marginBottom: '4px'
                            }}
                          >
                            {d.date.slice(5)}: {d.count} ca
                          </span>
                        )) || <span style={{ color: '#94a3b8', fontSize: '12px' }}>Chưa có ngày chốt ca</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontSize: '15px' }}>
                        {item ? item.totalShifts : 0} ca
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL XẾP LẠI LỊCH ==================== */}
      {editingSession && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleSaveReschedule} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Xếp Lại Ca: {editingSession.clientName}</h3>

            <label style={styles.fieldGroup}>
              <span>Tên khách hiển thị:</span>
              <input
                type="text"
                value={editForm.clientName}
                onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                style={styles.input}
              />
            </label>

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
              <button type="button" onClick={handleDeleteSession} className="btn" style={{ background: '#e11d48', color: '#fff' }}>
                🗑 Xóa ca
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditingSession(null)} className="btn btn-gray">
                  Đóng
                </button>
                <button type="submit" className="btn btn-blue">
                  Lưu Lại
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL THÊM CA TẬP ==================== */}
      {showAddModal && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleAddSession} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Thêm Ca Tập ({selectedDate})</h3>

            <label style={styles.fieldGroup}>
              <span>Chọn khách có sẵn (hoặc nhập tên mới ở dưới):</span>
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
              <span>Tên khách hàng:</span>
              <input
                type="text"
                required
                value={addForm.clientName}
                onChange={e => setAddForm({ ...addForm, clientName: e.target.value })}
                style={styles.input}
              />
            </label>

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
              <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-gray">
                Hủy
              </button>
              <button type="submit" className="btn btn-blue">
                Thêm Vào Lịch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL SỬA LỊCH TUẦN KHÁCH HÀNG ==================== */}
      {editingClient && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, width: '500px' }}>
            <h3 style={styles.modalTitle}>
              {editingClient._id ? `Lịch Tuần: ${editingClient.name}` : 'Thêm Khách Hàng Mới'}
            </h3>

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
                        padding: '5px 8px',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        borderRadius: '6px'
                      }}
                    >
                      <label style={{ width: '85px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
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
              <button onClick={() => setEditingClient(null)} className="btn btn-gray">
                Đóng
              </button>
              <button
                onClick={async () => {
                  if (editingClient._id) {
                    await handleSaveClientWeekly();
                  } else {
                    const res = await axios.post(`${API_URL}/clients`, editingClient);
                    setClients([...clients, res.data]);
                    setEditingClient(null);
                  }
                }}
                className="btn btn-blue"
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
  input: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '10px' },
  modalCard: { background: '#fff', padding: '18px', borderRadius: '12px', width: '400px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.2)' },
  modalTitle: { marginTop: 0, marginBottom: '12px', fontSize: '16px', fontWeight: 800 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '13px', fontWeight: 600 },
  scopePanel: { background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', marginTop: '4px' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px' }
};
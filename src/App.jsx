// Tệp: frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import {
  API_URL,
  styles,
  isDoubleSession,
  getCleanSessionName,
  formatSessionNameWithDouble,
  splitDoubleClientNames,
  parseClientNoteAndTime,
  attachUpdateTimestamp,
  formatUpdateTime,
  getTodayStr,
  getCurrentYearMonth,
  getMonthRange,
  getCurrentWeekRange,
  parseTimeToMinutes,
  formatHeaderDate,
  exportDailyScheduleExcel,
  exportWeeklySummaryExcel
} from './utils';
import Modals from './Modals';

export default function App() {
  const weekRange = getCurrentWeekRange();

  // Lưu nhớ trạng thái đăng nhập trong localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_dinhle_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // State Form Đăng nhập & Đăng ký
  const [authMode, setAuthMode] = useState('LOGIN'); // LOGIN | REGISTER
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '', trainerId: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | ACTIVE | PAUSED
  const [searchClient, setSearchClient] = useState('');
  const [sortClientMode, setSortClientMode] = useState('DEFAULT');
  const [editingClient, setEditingClient] = useState(null);
  const [showPausedModal, setShowPausedModal] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [weeklySummary, setWeeklySummary] = useState([]);

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    document.title = 'Gym DinhLe';
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = '/logo.png';

    if (currentUser) {
      fetchInitData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadDailySchedule(selectedDate);
    }
  }, [selectedDate, currentUser]);

  const fetchInitData = async () => {
    try {
      const res = await axios.get(`${API_URL}/init`);
      setTrainers(res.data.trainers);
      setClients(res.data.clients);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu:', err);
    }
  };

  const loadDailySchedule = async (date) => {
    try {
      const res = await axios.post(`${API_URL}/daily-schedule`, { date });
      setSessions(res.data);
    } catch (err) {
      console.error('Lỗi tải lịch ngày:', err);
    }
  };

  // ==================== XỬ LÝ ĐĂNG NHẬP / ĐĂNG KÝ / ĐĂNG XUẤT ====================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'LOGIN') {
        const res = await axios.post(`${API_URL}/auth/login`, {
          username: authForm.username,
          password: authForm.password
        });
        const user = res.data.user;
        setCurrentUser(user);
        localStorage.setItem('gym_dinhle_user', JSON.stringify(user));
      } else {
        const res = await axios.post(`${API_URL}/auth/register`, {
          username: authForm.username,
          password: authForm.password,
          name: authForm.name,
          trainerId: authForm.trainerId || null
        });
        const user = res.data.user;
        alert('Đăng ký tài khoản PT thành công! Bạn có thể xem lịch ngay.');
        setCurrentUser(user);
        localStorage.setItem('gym_dinhle_user', JSON.stringify(user));
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Đã có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
      setCurrentUser(null);
      localStorage.removeItem('gym_dinhle_user');
      setAuthForm({ username: '', password: '', name: '', trainerId: '' });
      setAuthError('');
    }
  };

  // ==================== CÁC HÀM XỬ LÝ LỊCH & KHÁCH HÀNG ====================
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

  const exportDailyToExcel = () =>
    exportDailyScheduleExcel({
      selectedDate,
      trainers,
      sessions,
      dynamicRowCount,
      getSortedTrainerSessions
    });

  const exportWeeklyToExcel = () =>
    exportWeeklySummaryExcel({
      startDate,
      endDate,
      trainers,
      weeklySummary
    });

  const handleResyncFromWeekly = async () => {
    if (!isAdmin) return alert('Chỉ có tài khoản Admin mới có quyền đồng bộ lại lịch tuần!');
    if (!window.confirm('Đồng bộ lại lịch ngày này theo Lịch Cố Định Tuần?')) return;
    const res = await axios.post(`${API_URL}/daily-schedule/resync`, { date: selectedDate });
    setSessions(res.data);
  };

  const openEditModal = (session) => {
    if (!isAdmin) return alert('Tài khoản Huấn Luyện Viên (PT) chỉ có quyền xem lịch, không được sửa ca!');
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
    if (!isAdmin) return alert('Chỉ Admin mới có quyền xếp lại ca!');
    let baseName = editForm.clientName.trim();

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
    if (!isAdmin) return alert('Chỉ Admin mới có quyền hủy ca!');
    if (session.isLocked) return alert('Ngày này đã khóa sổ! Hãy mở khóa nếu muốn chỉnh sửa.');
    const newStatus = session.status === 'CANCELLED' ? 'SCHEDULED' : 'CANCELLED';
    const res = await axios.put(`${API_URL}/daily-session/${session._id}/reschedule`, {
      status: newStatus,
      updateScope: 'DAILY'
    });
    setSessions(sessions.map(s => (s._id === session._id ? res.data : s)));
  };

  const handleDeleteSession = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền xóa ca!');
    await axios.delete(`${API_URL}/daily-session/${editingSession._id}`);
    setSessions(sessions.filter(s => s._id !== editingSession._id));
    setEditingSession(null);
  };

  const handleDragStart = (e, sessionId) => {
    if (!isAdmin) return;
    e.dataTransfer.setData('sessionId', sessionId);
  };

  const handleDropOnTrainer = async (e, targetTrainerId) => {
    e.preventDefault();
    if (!isAdmin) return;
    const sessionId = e.dataTransfer.getData('sessionId');
    if (!sessionId) return;
    const res = await axios.put(`${API_URL}/daily-session/${sessionId}/reschedule`, {
      trainerId: targetTrainerId,
      updateScope: 'DAILY'
    });
    setSessions(sessions.map(s => (s._id === sessionId ? res.data : s)));
  };

  const handleToggleTrainerOff = async (trainerId) => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền báo OFF Huấn Luyện Viên!');
    const res = await axios.post(`${API_URL}/daily-schedule/toggle-off`, {
      date: selectedDate,
      trainerId
    });
    setSessions(res.data);
  };

  const openQuickAddForTrainer = (trainerId) => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền thêm ca tập mới!');
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
    if (!isAdmin) return alert('Chỉ Admin mới có quyền thêm ca!');
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
    if (!isAdmin) return alert('Chỉ Admin mới có quyền Chốt ca!');
    const res = await axios.post(`${API_URL}/daily-schedule/close`, { date: selectedDate });
    setSessions(res.data);
  };

  const handleReopenDay = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền Mở khóa!');
    const res = await axios.post(`${API_URL}/daily-schedule/reopen`, { date: selectedDate });
    setSessions(res.data);
  };

  const handleSaveClientWeekly = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền sửa lịch tuần!');
    const payload = {
      ...editingClient,
      packageNote: attachUpdateTimestamp(editingClient.packageNote)
    };
    const res = await axios.put(`${API_URL}/clients/${editingClient._id}`, payload);
    setClients(clients.map(c => (c._id === editingClient._id ? res.data : c)));
    setEditingClient(null);
  };

  // Nút bật toàn bộ khách hàng sang trạng thái OFF (PAUSED) để chuẩn bị xếp lịch tuần mới
  const handlePauseAllClients = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền chuyển toàn bộ học viên sang OFF!');
    const confirm = window.confirm(
      'BẠN CÓ CHẮC CHẮN MUỐN CHUYỂN TOÀN BỘ HỌC VIÊN SANG TRẠNG THÁI TẠM NGHỈ (OFF)?\\n\\n' +
      '• Toàn bộ học viên sẽ chuyển thành PAUSED để bạn kiểm tra ai xác nhận tập lại.\\n' +
      '• Khi học viên báo lịch tập mới, bạn chỉ cần sửa lại trạng thái "Đang tập" và điền giờ.'
    );
    if (!confirm) return;

    try {
      const res = await axios.post(`${API_URL}/clients/pause-all`);
      alert(res.data.message);
      setClients(res.data.clients);
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.error || err.message));
    }
  };

  // Nút xóa vĩnh viễn 1 khách hàng trong Modal Cập nhật lịch
  const handleDeleteClient = async (client) => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền xóa học viên!');
    const confirm = window.confirm(
      `BẠN CÓ CHẮC CHẮN MUỐN XÓA VĨNH VIỄN KHÁCH HÀNG: "${client.name.toUpperCase()}"?\\n\\n` +
      '• Toàn bộ thông tin và lịch tập cố định tuần của khách này sẽ bị xóa khỏi cơ sở dữ liệu.'
    );
    if (!confirm) return;

    try {
      await axios.delete(`${API_URL}/clients/${client._id}`);
      setClients(clients.filter(c => c._id !== client._id));
      setEditingClient(null);
      alert(`Đã xóa thành công học viên ${client.name}!`);
    } catch (err) {
      alert('Lỗi khi xóa khách: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadWeeklySummary = async (customStart = startDate, customEnd = endDate) => {
    const res = await axios.get(`${API_URL}/weekly-summary`, {
      params: { startDate: customStart, endDate: customEnd }
    });
    setWeeklySummary(res.data);
  };

  const handleSelectFullMonth = (ymStr) => {
    setSelectedMonth(ymStr);
    const { start, end } = getMonthRange(ymStr);
    setStartDate(start);
    setEndDate(end);
    loadWeeklySummary(start, end);
  };

  const handleDeleteMonthSessions = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền xóa dữ liệu tháng!');
    const { start, end, label } = getMonthRange(selectedMonth);
    const confirmMsg =
      `BẠN CÓ CHẮC CHẮN MUỐN XÓA DỮ LIỆU CHỐT CA CỦA ${label.toUpperCase()}?\\n\\n` +
      `• Khoảng thời gian xóa: Từ ${start} đến ${end}\\n` +
      `• Danh sách khách hàng và Lịch Tuần cố định vẫn được GIỮ NGUYÊN 100%.\\n` +
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

  // ==================== NẾU CHƯA ĐĂNG NHẬP: HIỆN GIAO DIỆN LOGIN / REGISTER ====================
  if (!currentUser) {
    return (
      <div className="AuthBackdrop">
        <div className="AuthCard">
          <img src="/logo.png" alt="Logo" className="AuthLogo" />
          <h2 className="AuthTitle">GYM DINHLE</h2>
          <div className="AuthSub">Fitness Center & Personal Trainer Management</div>

          <div className="AuthTabs">
            <button
              onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
              className={`AuthTabBtn ${authMode === 'LOGIN' ? 'active' : ''}`}
            >
              🔐 Đăng Nhập
            </button>
            <button
              onClick={() => { setAuthMode('REGISTER'); setAuthError(''); }}
              className={`AuthTabBtn ${authMode === 'REGISTER' ? 'active' : ''}`}
            >
              📝 Đăng Ký PT
            </button>
          </div>

          {authError && <div className="AuthErrorBox">⚠️ {authError}</div>}

          <form onSubmit={handleAuthSubmit} className="AuthForm">
            {authMode === 'REGISTER' && (
              <label className="AuthLabel">
                <span>Họ và Tên Huấn Luyện Viên:</span>
                <input
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A (PT)"
                  value={authForm.name}
                  onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                  className="AuthInput"
                />
              </label>
            )}

            <label className="AuthLabel">
              <span>Tên đăng nhập:</span>
              <input
                type="text"
                required
                placeholder={authMode === 'LOGIN' ? 'Tài khoản admin hoặc PT' : 'Tên tài khoản (viết liền)'}
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                className="AuthInput"
              />
            </label>

            <label className="AuthLabel">
              <span>Mật khẩu:</span>
              <input
                type="password"
                required
                placeholder="Nhập mật khẩu"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                className="AuthInput"
              />
            </label>

            <button type="submit" disabled={authLoading} className="AuthSubmitBtn">
              {authLoading
                ? 'Đang xử lý...'
                : authMode === 'LOGIN'
                ? 'Đăng Nhập Vào Hệ Thống'
                : 'Tạo Tài Khoản Huấn Luyện Viên'}
            </button>
          </form>

          <div className="AuthHint">
            🔒 <strong>Tài khoản Admin:</strong> <code>dinhle</code> / <code>dinhle123</code>
            <br />
            👥 <strong>Tài khoản PT:</strong> Có thể bấm qua mục <em>"Đăng Ký PT"</em> để tạo tài khoản xem lịch.
          </div>
        </div>
      </div>
    );
  }

  // ==================== ĐÃ ĐĂNG NHẬP: GIAO DIỆN CHÍNH ====================
  const isDayLocked = sessions.some(s => s.isLocked);
  const validDaySessions = sessions.filter(s => s.status !== 'CANCELLED');
  const totalValidShifts = validDaySessions.length;
  const totalDoubleShiftsToday = validDaySessions.filter(s => isDoubleSession(s)).length;
  const totalCancelledShifts = sessions.filter(
    s => s.status === 'CANCELLED' && s.clientName !== 'OFF'
  ).length;

  const pausedClientsCount = clients.filter(c => c.status === 'PAUSED').length;

  const displayedClients = clients
    .filter(c => filterTrainer === 'ALL' || (c.primaryTrainerId?._id || c.primaryTrainerId) === filterTrainer)
    .filter(c => filterStatus === 'ALL' || c.status === filterStatus)
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

          <div className="HeaderRightSide">
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

            <div className="UserBadge">
              <span>{currentUser.name}</span>
              <span className={`RoleTag ${isAdmin ? 'admin' : 'pt'}`}>
                {isAdmin ? 'ADMIN' : 'PT'}
              </span>
              <button onClick={handleLogout} className="LogoutBtn" title="Đăng xuất tài khoản">
                🚪 Thoát
              </button>
            </div>
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

                {/* Nút xem danh sách khách đang OFF */}
                <button
                  onClick={() => setShowPausedModal(true)}
                  className="PausedBadgeBtn"
                  title="Xem danh sách những khách hàng đang tạm nghỉ / OFF"
                >
                  ⏸ Đang OFF: <strong>{pausedClientsCount} khách</strong>
                </button>

                {isAdmin && (
                  <>
                    <button
                      onClick={() => openQuickAddForTrainer(trainers[0]?._id || '')}
                      className="Btn BtnBlue"
                    >
                      + Thêm Ca / Ca Đôi
                    </button>

                    <button onClick={handleResyncFromWeekly} className="Btn BtnLight">
                      🔄 Đồng Bộ Tuần
                    </button>
                  </>
                )}
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

                {isAdmin && (
                  !isDayLocked ? (
                    <button onClick={handleCloseDay} className="Btn BtnGreen">
                      ✅ Chốt Ca
                    </button>
                  ) : (
                    <button onClick={handleReopenDay} className="Btn BtnOrange">
                      🔓 Mở Khóa
                    </button>
                  )
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

              {/* CHẾ ĐỘ 1: BẢNG MA TRẬN CHỐNG CẮT CHỮ TRIỆT ĐỂ */}
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
                              <div className="TrainerName" title={trainer.name}>{trainer.name}</div>
                              <div className="TrainerActionRow">
                                {isAdmin ? (
                                  <>
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
                                  </>
                                ) : (
                                  <span style={{ fontSize: '11px', color: isOff ? '#b45309' : '#166534', fontWeight: 700 }}>
                                    {isOff ? 'OFF' : 'Hoạt động'}
                                  </span>
                                )}
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
                            const nameParts = cellSession ? splitDoubleClientNames(cellSession.clientName) : [];

                            return (
                              <td
                                key={trainer._id}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => handleDropOnTrainer(e, trainer._id)}
                              >
                                {cellSession && (
                                  <div
                                    draggable={isAdmin && !cellSession.isLocked && !isOffMarker}
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
                                    ) : isDouble ? (
                                      /* CA ĐÔI: HIỂN THỊ TÊN 2 KHÁCH XẾP DÒNG DỌC KHÔNG CẮT CHỮ */
                                      <>
                                        <div
                                          className="DoubleNamesStack"
                                          style={{
                                            textDecoration: isCancelled ? 'line-through' : 'none'
                                          }}
                                        >
                                          {nameParts.map((person, pIdx) => (
                                            <div key={pIdx} className="DoublePersonLine">
                                              <span className="PersonDot">•</span>
                                              <span>{person}</span>
                                            </div>
                                          ))}
                                        </div>

                                        <div className="SessionBottomRow">
                                          <span className="DoubleBadge">👥 Ca đôi</span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span className="TimePill">{cellSession.time || 'h'}</span>
                                            {isAdmin && !cellSession.isLocked && (
                                              <button
                                                onClick={e => handleQuickToggleCancel(cellSession, e)}
                                                className="CancelBtn"
                                                title={isCancelled ? 'Khôi phục' : 'Gạch hủy ca'}
                                              >
                                                {isCancelled ? '↺' : '✕'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      /* CA ĐƠN: TÊN ĐƯỢC ƯU TIÊN TRÊN CÙNG CHIẾM 100% CHIỀU RỘNG */
                                      <>
                                        <div className="SessionTopRow">
                                          <span
                                            className="ClientTitle"
                                            style={{
                                              textDecoration: isCancelled ? 'line-through' : 'none'
                                            }}
                                          >
                                            {getCleanSessionName(cellSession.clientName)}
                                          </span>
                                        </div>

                                        <div className="SessionBottomRow">
                                          <span className="TimePill">
                                            {cellSession.time || 'h'}
                                          </span>
                                          {isAdmin && !cellSession.isLocked && (
                                            <button
                                              onClick={e => handleQuickToggleCancel(cellSession, e)}
                                              className="CancelBtn"
                                              title={isCancelled ? 'Khôi phục' : 'Gạch hủy ca'}
                                            >
                                              {isCancelled ? '↺' : '✕'}
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* DÒNG CHỐT CA CUỐI BẢNG */}
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
                              <div className="FooterCellWrap">
                                <span className="FooterCountBadge">{validCount}</span>
                                {doubleCount > 0 && (
                                  <span className="FooterDoubleNote">
                                    📝 Có {doubleCount} ca đôi
                                  </span>
                                )}
                              </div>
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
                            {isAdmin && (
                              <>
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
                              </>
                            )}
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
                                    <div className="SingleRowLayout">
                                      <span
                                        className="ClientTitle"
                                        style={{
                                          textDecoration: isCancelled ? 'line-through' : 'none'
                                        }}
                                      >
                                        #{idx + 1}.{' '}
                                        {isDouble && (
                                          <span className="DoubleBadge" style={{ marginRight: '5px' }}>
                                            👥 Ca đôi
                                          </span>
                                        )}
                                        {getCleanSessionName(cellSession.clientName)}
                                      </span>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span className="TimePill">{cellSession.time || 'h'}</span>
                                        {isAdmin && !cellSession.isLocked && (
                                          <button
                                            onClick={e => handleQuickToggleCancel(cellSession, e)}
                                            className="CancelBtn"
                                          >
                                            {isCancelled ? '↺' : '✕'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
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

      {/* ==================== TAB 2: QUẢN LÝ LỊCH TUẦN & NÚT BẬT TOÀN BỘ KHÁCH OFF ==================== */}
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
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={styles.input}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">● Đang tập ({clients.filter(c => c.status === 'ACTIVE').length})</option>
                <option value="PAUSED">⏸ Tạm nghỉ / OFF ({pausedClientsCount})</option>
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
                style={{ ...styles.input, flex: 1, minWidth: '160px' }}
              />
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Nút bật toàn bộ khách hàng sang trạng thái OFF */}
                <button
                  onClick={handlePauseAllClients}
                  className="Btn BtnOrange"
                  title="Chuyển toàn bộ khách hàng sang Tạm nghỉ (OFF) để kiểm tra ai tập tuần mới"
                >
                  ⏸ Chuyển Toàn Bộ Sang OFF
                </button>

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
            )}
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
                      {client.status === 'ACTIVE' ? '● Đang tập' : '⏸ Tạm nghỉ (OFF)'}
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
                      {isAdmin ? '✏️ Chỉnh Sửa / Xóa Khách' : '👁️ Xem Chi Tiết Lịch'}
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

              {isAdmin && (
                <button onClick={handleDeleteMonthSessions} className="Btn BtnRed">
                  🗑 Xóa Chốt Ca {currentMonthInfo.label}
                </button>
              )}
            </div>
          </div>

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

      {/* ==================== 4 HỘP THOẠI MODAL ==================== */}
      <Modals
        selectedDate={selectedDate}
        trainers={trainers}
        clients={clients}
        setClients={setClients}
        sessions={sessions}
        editingSession={editingSession}
        setEditingSession={setEditingSession}
        editForm={editForm}
        setEditForm={setEditForm}
        handleSaveReschedule={handleSaveReschedule}
        handleDeleteSession={handleDeleteSession}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        addForm={addForm}
        setAddForm={setAddForm}
        handleAddSession={handleAddSession}
        editingClient={editingClient}
        setEditingClient={setEditingClient}
        handleSaveClientWeekly={handleSaveClientWeekly}
        handleDeleteClient={handleDeleteClient}
        showPausedModal={showPausedModal}
        setShowPausedModal={setShowPausedModal}
        isAdmin={isAdmin}
      />
    </div>
  );
}
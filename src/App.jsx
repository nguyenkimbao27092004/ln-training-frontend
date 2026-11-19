// Tệp: frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import {
  API_URL,
  DAYS,
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

// ==================== HỆ THỐNG ICON VECTOR TỐI GIẢN (SVG) CHO KHÁCH HÀNG & PT ====================
const SvgDumbbell = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" />
    <path d="M19.5 6.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" />
    <path d="M2 9.5v5" />
    <path d="M22 9.5v5" />
    <path d="M7.5 12h9" />
  </svg>
);

const SvgPause = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="6" y="5" width="4" height="14" rx="1.5" />
    <rect x="14" y="5" width="4" height="14" rx="1.5" />
  </svg>
);

const SvgUserCheck = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3.8" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const SvgUsersGroup = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5.5a4 4 0 0 0-4 4v2" />
    <circle cx="8.75" cy="7" r="3.5" />
    <path d="M22.5 21v-2a4 4 0 0 0-3-3.85" />
    <path d="M16.5 3.2a3.5 3.5 0 0 1 0 6.6" />
  </svg>
);

const SvgVideoOnline = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="6" width="13.5" height="12" rx="2.5" />
    <path d="m21.5 8.5-5.5 3.5 5.5 3.5v-7z" />
  </svg>
);

// Tự động phân loại khách hàng (OFF / Tập nhóm / Tập Online / Tập 1-1) để chọn icon & màu tương ứng
function getClientVisualInfo(client = {}) {
  const isActive = client.status === 'ACTIVE';
  if (!isActive) {
    return {
      variant: 'paused',
      label: 'Hội viên đang tạm nghỉ (OFF)',
      renderIcon: (size = 18) => <SvgPause size={size} />
    };
  }

  const normalizedName = String(client.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const isGroup =
    normalizedName.includes('nhom') ||
    normalizedName.includes('+') ||
    normalizedName.includes('ca doi') ||
    normalizedName.includes('cap ') ||
    /\b\d+\s*nguoi\b/.test(normalizedName);

  if (isGroup) {
    return {
      variant: 'group',
      label: 'Hội viên tập nhóm / ca đôi',
      renderIcon: (size = 18) => <SvgUsersGroup size={size} />
    };
  }

  const isOnline = /\b(online|onl)\b/.test(normalizedName);
  if (isOnline) {
    return {
      variant: 'online',
      label: 'Hội viên tập Online',
      renderIcon: (size = 18) => <SvgVideoOnline size={size} />
    };
  }

  return {
    variant: 'active',
    label: 'Hội viên tập 1-1 đang hoạt động',
    renderIcon: (size = 18) => <SvgUserCheck size={size} />
  };
}

// Tự động phân loại trạng thái PT (Nghỉ phép OFF / Đang có ca / Chưa có ca)
function getTrainerVisualInfo({ isOff = false, validCount = 0 } = {}) {
  if (isOff) {
    return {
      variant: 'off',
      label: 'Huấn luyện viên đang nghỉ phép (OFF)',
      renderIcon: (size = 17) => <SvgPause size={size} />
    };
  }
  if (validCount > 0) {
    return {
      variant: 'active',
      label: `Huấn luyện viên đang có ${validCount} ca`,
      renderIcon: (size = 17) => <SvgDumbbell size={size} />
    };
  }
  return {
    variant: 'idle',
    label: 'Huấn luyện viên chưa có ca',
    renderIcon: (size = 17) => <SvgDumbbell size={size} />
  };
}

export default function App() {
  const weekRange = getCurrentWeekRange();

  // Lưu nhớ trạng thái đăng nhập Admin/PT trong localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_dinhle_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Lưu nhớ trạng thái đăng nhập của KHÁCH HÀNG (Tra cứu bằng SĐT)
  const [clientPortalData, setClientPortalData] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_dinhle_client_portal');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [clientPhoneInput, setClientPhoneInput] = useState('');

  // State Form Đăng nhập & Đăng ký & Khách hàng
  const [authMode, setAuthMode] = useState('CLIENT'); // CLIENT | LOGIN | REGISTER
  const [authForm, setAuthForm] = useState({ username: '', password: '', name: '', trainerId: '', registerCode: '' });
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
    secondClientName: '',
    workoutType: '',
    workoutNote: ''
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
    saveToWeekly: false,
    workoutType: '',
    workoutNote: ''
  });

  const [filterTrainer, setFilterTrainer] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | ACTIVE | PAUSED
  const [filterDay, setFilterDay] = useState('ALL'); // ALL | 2..8
  const [filterMissingPhone, setFilterMissingPhone] = useState(false);
  const [searchClient, setSearchClient] = useState('');
  const [sortClientMode, setSortClientMode] = useState('DEFAULT');
  const [editingClient, setEditingClient] = useState(null);
  const [showPausedModal, setShowPausedModal] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [weeklySummary, setWeeklySummary] = useState([]);
  const [summaryViewMode, setSummaryViewMode] = useState('CARDS'); // CARDS | TABLE

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

  // ==================== XỬ LÝ ĐĂNG NHẬP ADMIN / PT / KHÁCH HÀNG ====================
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
      } else if (authMode === 'REGISTER') {
        if (authForm.registerCode.trim().toLowerCase() !== 'dinhle') {
          setAuthError('Mã xác nhận đăng ký PT không chính xác!');
          setAuthLoading(false);
          return;
        }
        const res = await axios.post(`${API_URL}/auth/register`, {
          username: authForm.username,
          password: authForm.password,
          name: authForm.name,
          trainerId: authForm.trainerId || null,
          registerCode: authForm.registerCode.trim()
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

  // Xử lý Form Đăng nhập riêng cho Khách hàng bằng Số điện thoại (hoặc 4 số cuối)
  const handleClientLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const phoneToQuery = clientPhoneInput || clientPortalData?.client?.phone;
      const res = await axios.post(`${API_URL}/auth/client-login`, {
        phone: phoneToQuery
      });
      setClientPortalData(res.data);
      localStorage.setItem('gym_dinhle_client_portal', JSON.stringify(res.data));
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Không tìm thấy số điện thoại này');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClientLogout = () => {
    setClientPortalData(null);
    setClientPhoneInput('');
    localStorage.removeItem('gym_dinhle_client_portal');
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
      setCurrentUser(null);
      localStorage.removeItem('gym_dinhle_user');
      setAuthForm({ username: '', password: '', name: '', trainerId: '', registerCode: '' });
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

  // Cho phép cả Admin và PT bấm vào ca tập (Admin sửa mọi thứ, PT ghi bài tập cho khách)
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
      secondClientName: '',
      workoutType: session.workoutType || '',
      workoutNote: session.workoutNote || ''
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

    // Nếu là PT: Chỉ lưu thông tin Bài Tập (workoutType & workoutNote)
    if (!isAdmin) {
      const res = await axios.put(
        `${API_URL}/daily-session/${editingSession._id}/workout`,
        {
          workoutType: editForm.workoutType,
          workoutNote: editForm.workoutNote,
          saveToWeekly: editForm.updateScope === 'WEEKLY'
        }
      );
      setSessions(sessions.map(s => (s._id === editingSession._id ? res.data : s)));
      if (editForm.updateScope === 'WEEKLY') {
        await fetchInitData();
      }
      setEditingSession(null);
      return;
    }

    // Nếu là Admin: Lưu toàn bộ như cũ + Bài Tập
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
      updateScope: editForm.updateScope,
      workoutType: editForm.workoutType,
      workoutNote: editForm.workoutNote
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
      saveToWeekly: false,
      workoutType: '',
      workoutNote: ''
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
      saveToWeekly: addForm.saveToWeekly,
      workoutType: addForm.workoutType,
      workoutNote: addForm.workoutNote
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

  // Cả Admin và PT đều có thể lưu giáo án/bài tập tuần & SĐT của khách
  const handleSaveClientWeekly = async () => {
    const payload = {
      ...editingClient,
      packageNote: attachUpdateTimestamp(editingClient.packageNote)
    };
    const res = await axios.put(`${API_URL}/clients/${editingClient._id}`, payload);
    setClients(clients.map(c => (c._id === editingClient._id ? res.data : c)));
    setEditingClient(null);
  };

  const handlePauseAllClients = async () => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền chuyển toàn bộ học viên sang OFF!');
    const confirm = window.confirm(
      'BẠN CÓ CHẮC CHẮN MUỐN CHUYỂN TOÀN BỘ HỌC VIÊN SANG TRẠNG THÁI TẠM NGHỈ (OFF)?\n\n' +
      '• Toàn bộ học viên sẽ chuyển thành PAUSED để bạn kiểm tra ai xác nhận tập lại.\n' +
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

  const handleDeleteClient = async (client) => {
    if (!isAdmin) return alert('Chỉ Admin mới có quyền xóa học viên!');
    const confirm = window.confirm(
      `BẠN CÓ CHẮC CHẮN MUỐN XÓA VĨNH VIỄN KHÁCH HÀNG: "${client.name.toUpperCase()}"?\n\n` +
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
      `BẠN CÓ CHẮC CHẮN MUỐN XÓA DỮ LIỆU CHỐT CA CỦA ${label.toUpperCase()}?\n\n` +
      `• Khoảng thời gian xóa: Từ ${start} đến ${end}\n` +
      `• Danh sách khách hàng và Lịch Tuần cố định vẫn được GIỮ NGUYÊN 100%.\n` +
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

  // ==================== GIAO DIỆN DÀNH RIÊNG CHO KHÁCH HÀNG SAU KHI NHẬP SĐT ====================
  if (!currentUser && clientPortalData) {
    const { client, trainers: portalTrainers = [], recentSessions = [] } = clientPortalData;
    const { cleanNote } = parseClientNoteAndTime(client.packageNote, client.updatedAt);
    const todayStr = getTodayStr();
    const jsDay = new Date().getDay();
    const todayDayOfWeek = jsDay === 0 ? 8 : jsDay + 1;

    const getTrainerName = (tId) => {
      if (!tId) return client.primaryTrainerId?.name || 'PT Gym DinhLe';
      if (typeof tId === 'object' && tId.name) return tId.name;
      const found = portalTrainers.find(t => String(t._id) === String(tId));
      return found ? found.name : (client.primaryTrainerId?.name || 'PT Gym DinhLe');
    };

    // Lấy ngày YYYY-MM-DD tương ứng với từng thứ (T2=2 ... CN=8) của tuần hiện tại
    const getDateStrForCurrentWeekDay = (targetDayOfWeek) => {
      const now = new Date();
      const currentDow = now.getDay() === 0 ? 8 : now.getDay() + 1;
      const diff = targetDayOfWeek - currentDow;
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };

    // Tìm buổi xếp lịch thực tế theo ngày (ưu tiên ca đang hoạt động / đã chốt trước ca hủy)
    const findActualSessionByDate = (dateStr) => {
      const matches = recentSessions.filter(s => s.date === dateStr && s.clientName !== 'OFF');
      if (matches.length === 0) return null;
      return matches.find(s => s.status !== 'CANCELLED') || matches[0];
    };

    // Ưu tiên thông tin buổi tập của ca xếp lịch/chốt ca hôm đó; nếu trống mới lấy dự phòng từ lịch tuần
    const resolveWorkoutInfo = (actualSession, weeklySlot) => {
      const hasCustom = Boolean(actualSession?.workoutType || actualSession?.workoutNote);
      return {
        workoutType: hasCustom ? (actualSession.workoutType || '') : (weeklySlot?.workoutType || ''),
        workoutNote: hasCustom ? (actualSession.workoutNote || '') : (weeklySlot?.workoutNote || '')
      };
    };

    const todaySession = findActualSessionByDate(todayStr);
    const todayWeeklySlot = client.weeklySchedule?.find(s => s.dayOfWeek === todayDayOfWeek);

    const isTodayCancelled = todaySession?.status === 'CANCELLED';
    const isTodayCompleted = todaySession?.status === 'COMPLETED';
    const isTodayScheduled = !isTodayCancelled && Boolean(todaySession || todayWeeklySlot);

    const todayResolvedWorkout = isTodayCancelled
      ? { workoutType: '', workoutNote: '' }
      : resolveWorkoutInfo(todaySession, todayWeeklySlot);

    const activeWorkoutTypeToday = todayResolvedWorkout.workoutType;
    const activeWorkoutNoteToday = todayResolvedWorkout.workoutNote;
    const activeTimeToday = isTodayCancelled
      ? ''
      : (todaySession?.time || todayWeeklySlot?.time || '');
    const activeTrainerToday = getTrainerName(
      todaySession?.trainerId || todayWeeklySlot?.assignedTrainerId
    );

    // Lọc chỉ lấy những ca tập đã hoàn thành (COMPLETED) và luôn đầy đủ thông tin buổi tập
    const completedSessions = recentSessions
      .filter(s => s.status === 'COMPLETED' && s.clientName !== 'OFF')
      .map(s => {
        const [y, m, d] = (s.date || '').split('-').map(Number);
        const jsD = y && m && d ? new Date(y, m - 1, d).getDay() : 0;
        const dow = s.dayOfWeek || (jsD === 0 ? 8 : jsD + 1);
        const weeklySlot = client.weeklySchedule?.find(w => w.dayOfWeek === dow);
        const resolved = resolveWorkoutInfo(s, weeklySlot);
        return {
          ...s,
          workoutType: resolved.workoutType,
          workoutNote: resolved.workoutNote
        };
      });

    // Dữ liệu 7 ngày tuần này: ưu tiên dữ liệu xếp lịch & chốt ca thực tế từng ngày
    const currentWeekDays = DAYS.map(day => {
      const dateStr = getDateStrForCurrentWeekDay(day.num);
      const actualSession = findActualSessionByDate(dateStr);
      const weeklySlot = client.weeklySchedule?.find(s => s.dayOfWeek === day.num);
      const isCancelled = actualSession?.status === 'CANCELLED';
      const isCompleted = actualSession?.status === 'COMPLETED';
      const isExtraSession = !isCancelled && !weeklySlot && Boolean(actualSession);
      const hasSession = !isCancelled && Boolean(actualSession || weeklySlot);
      const resolved = isCancelled
        ? { workoutType: '', workoutNote: '' }
        : resolveWorkoutInfo(actualSession, weeklySlot);

      return {
        ...day,
        dateStr,
        isToday: day.num === todayDayOfWeek,
        actualSession,
        weeklySlot,
        isCancelled,
        isCompleted,
        isExtraSession,
        hasSession,
        time: actualSession?.time || weeklySlot?.time || '',
        trainerName: getTrainerName(actualSession?.trainerId || weeklySlot?.assignedTrainerId),
        workoutType: resolved.workoutType,
        workoutNote: resolved.workoutNote
      };
    });

    const weeklyCount = (client.weeklySchedule || []).length;
    const portalVisual = getClientVisualInfo(client);

    return (
      <div className="app-shell portal-shell">
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
              <h1 className="BrandText">GYM DINHLE — SỔ TAY LỊCH TẬP HỌC VIÊN</h1>
              <span className="BrandSub">Tra cứu lịch tập tuần & Giáo án cá nhân</span>
            </div>
          </div>

          <div className="HeaderRightSide">
            <div className="UserBadge">
              <span>👤 {client.name}</span>
              <span className="RoleTag" style={{ background: '#10b981', color: '#fff' }}>
                HỌC VIÊN
              </span>
              <button
                onClick={handleClientLoginSubmit}
                className="LogoutBtn"
                disabled={authLoading}
              >
                {authLoading ? '⏳ Đang tải...' : '🔄 Làm mới'}
              </button>
              <button onClick={handleClientLogout} className="LogoutBtn">
                🚪 Thoát
              </button>
            </div>
          </div>
        </header>

        <div className="PortalContainer">
          {/* 1. HERO CARD THÔNG TIN HỘI VIÊN */}
          <section className="PortalHeroCard">
            <div className="PortalHeroLeft">
              <div
                className={`PortalAvatar variant-${portalVisual.variant}`}
                title={portalVisual.label}
              >
                {portalVisual.renderIcon(26)}
              </div>
              <div className="PortalHeroInfo">
                <div className="PortalHeroKicker">
                  <span>HỒ SƠ HỘI VIÊN GYM DINHLE</span>
                  <span className={`PortalStatusChip ${client.status === 'ACTIVE' ? 'active' : 'paused'}`}>
                    {client.status === 'ACTIVE' ? '● Đang hoạt động' : '⏸ Đang tạm nghỉ (OFF)'}
                  </span>
                </div>
                <h2 className="PortalHeroName">{client.name}</h2>
                <div className="PortalHeroMeta">
                  <span className="PortalMetaPill">
                    📱 SĐT: <strong>{client.phone}</strong>
                  </span>
                  <span className="PortalMetaPill">
                    🏋️ PT phụ trách: <strong>{client.primaryTrainerId?.name || 'Đang cập nhật'}</strong>
                  </span>
                </div>
                {cleanNote && (
                  <div className="PortalHeroNote">
                    📌 Ghi chú gói tập: <strong>{cleanNote}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="PortalHeroStats">
              <div className="PortalStatTile">
                <span className="PortalStatNum">{weeklyCount}</span>
                <span className="PortalStatLabel">Buổi / tuần</span>
              </div>
              <div className="PortalStatTile tile-emerald">
                <span className="PortalStatNum">{completedSessions.length}</span>
                <span className="PortalStatLabel">Đã hoàn thành</span>
              </div>
            </div>
          </section>

          {/* 2. THẺ LỊCH TẬP HÔM NAY NỔI BẬT (ƯU TIÊN LỊCH XẾP & CHỐT CA THỰC TẾ) */}
          <section
            className={`PortalTodayCard ${
              isTodayCompleted ? 'today-done' : isTodayScheduled ? 'today-active' : 'today-rest'
            }`}
          >
            <div className="PortalTodayTop">
              <div className="PortalTodayDateBadge">
                <span>📅 HÔM NAY</span>
                <span className="PortalTodayDateDivider">•</span>
                <span>{formatHeaderDate(todayStr)}</span>
              </div>

              <span
                className={`PortalTodayStateTag ${
                  isTodayCompleted ? 'done' : isTodayScheduled ? 'scheduled' : 'rest'
                }`}
                style={
                  isTodayCancelled
                    ? { background: '#fee2e2', color: '#b91c1c' }
                    : undefined
                }
              >
                {isTodayCompleted
                  ? '✅ Đã chốt ca hoàn thành'
                  : isTodayCancelled
                  ? '✕ Đã báo nghỉ / Hủy'
                  : isTodayScheduled
                  ? todaySession
                    ? '🔥 Đã xếp lịch hôm nay'
                    : '🔥 Lịch tập hôm nay'
                  : '🌿 Ngày nghỉ phục hồi'}
              </span>
            </div>

            <div className="PortalTodayBody">
              {isTodayScheduled ? (
                <>
                  <div className="PortalTodayMain">
                    <div className="PortalTodayTimeBlock">
                      <span className="PortalTodayClock">⏰</span>
                      <div>
                        <div className="PortalTodayHeadline">
                          Ca tập lúc <span className="PortalTodayTimeHighlight">{activeTimeToday || 'Báo sau'}</span>
                        </div>
                        <div className="PortalTodaySubline">
                          Huấn luyện viên đồng hành: <strong>{activeTrainerToday}</strong>
                          {todaySession && isDoubleSession(todaySession) && (
                            <span
                              style={{
                                marginLeft: '8px',
                                background: '#ede9fe',
                                color: '#6d28d9',
                                padding: '2px 7px',
                                borderRadius: '99px',
                                fontSize: '11px',
                                fontWeight: 800
                              }}
                            >
                              👥 Ca đôi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeWorkoutTypeToday && (
                      <div className="PortalFocusBadge">
                        <span className="PortalFocusLabel">Nhóm cơ hôm nay</span>
                        <strong className="PortalFocusValue">🎯 {activeWorkoutTypeToday.toUpperCase()}</strong>
                      </div>
                    )}
                  </div>

                  {activeWorkoutNoteToday ? (
                    <div className="PortalWorkoutBox">
                      <div className="PortalWorkoutBoxTitle">
                        📝 Chi tiết giáo án hôm nay do PT soạn
                      </div>
                      <div className="PortalWorkoutBoxText">{activeWorkoutNoteToday}</div>
                    </div>
                  ) : (
                    <div className="PortalTodayTip">
                      💡 PT sẽ hướng dẫn chi tiết kỹ thuật và mức tạ phù hợp trực tiếp tại phòng tập.
                    </div>
                  )}
                </>
              ) : isTodayCancelled ? (
                <div className="PortalRestMessage">
                  <div
                    className="PortalRestIcon"
                    style={{ background: '#fef2f2', borderColor: '#fecaca' }}
                  >
                    ✕
                  </div>
                  <div>
                    <div className="PortalTodayHeadline">Buổi tập hôm nay đã được báo nghỉ / hủy</div>
                    <div className="PortalTodaySubline">
                      Lịch ngày hôm nay đã cập nhật trạng thái nghỉ. Hẹn gặp lại bạn ở buổi tập tiếp theo!
                    </div>
                  </div>
                </div>
              ) : (
                <div className="PortalRestMessage">
                  <div className="PortalRestIcon">🌿</div>
                  <div>
                    <div className="PortalTodayHeadline">Hôm nay bạn không có lịch tập cố định</div>
                    <div className="PortalTodaySubline">
                      Hãy dành thời gian giãn cơ nhẹ, bổ sung đủ nước và dinh dưỡng để cơ bắp phục hồi tốt nhất!
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. LỊCH TẬP TRONG TUẦN NÀY (ƯU TIÊN LỊCH XẾP & CHỐT CA THỰC TẾ) */}
          <section className="PortalSection">
            <div className="PortalSectionHeader">
              <div>
                <h3 className="PortalSectionTitle">📅 Lịch Tập Trong Tuần Của Bạn</h3>
                <p className="PortalSectionSub">
                  Tự động đồng bộ theo lịch xếp thực tế & chốt ca từng ngày (kết hợp lịch cố định)
                </p>
              </div>
              <span className="PortalCountChip">{weeklyCount} buổi cố định / tuần</span>
            </div>

            {/* Thanh tổng quan nhanh 7 ngày trong tuần */}
            <div className="PortalWeekStrip">
              {currentWeekDays.map(day => {
                const shortLabel = day.num === 8 ? 'CN' : `T${day.num}`;
                return (
                  <div
                    key={day.num}
                    className={`PortalStripItem ${day.hasSession ? 'has-slot' : 'is-rest'} ${day.isToday ? 'is-today' : ''}`}
                    style={
                      day.isCompleted
                        ? { background: '#ecfdf5', borderColor: day.isToday ? '#10b981' : '#a7f3d0' }
                        : day.isCancelled
                        ? { background: '#fef2f2', borderColor: day.isToday ? '#ef4444' : '#fecaca' }
                        : undefined
                    }
                  >
                    <span
                      className="PortalStripDay"
                      style={
                        day.isCompleted
                          ? { color: '#047857' }
                          : day.isCancelled
                          ? { color: '#b91c1c' }
                          : undefined
                      }
                    >
                      {shortLabel}
                    </span>
                    <span
                      className="PortalStripTime"
                      style={
                        day.isCompleted
                          ? { color: '#059669' }
                          : day.isCancelled
                          ? { color: '#dc2626' }
                          : undefined
                      }
                    >
                      {day.isCancelled
                        ? 'Đã hủy'
                        : day.hasSession
                        ? `${day.isCompleted ? '✓ ' : ''}${day.time || 'Có lịch'}`
                        : 'Nghỉ'}
                    </span>
                    {day.isToday && <span className="PortalStripTodayDot" title="Hôm nay" />}
                  </div>
                );
              })}
            </div>

            {/* Lưới chi tiết từng thứ */}
            <div className="PortalWeekGrid">
              {currentWeekDays.map(day => (
                <div
                  key={day.num}
                  className={`PortalDayCard ${day.hasSession ? 'has-session' : 'rest-day'} ${day.isToday ? 'is-today' : ''}`}
                  style={
                    day.isCompleted
                      ? { borderTopColor: '#10b981' }
                      : day.isCancelled
                      ? { borderColor: '#fecaca', background: '#fffafa' }
                      : undefined
                  }
                >
                  <div className="PortalDayCardTop">
                    <div className="PortalDayTitleGroup" style={{ flexWrap: 'wrap' }}>
                      <span className="PortalDayName">{day.label}</span>
                      {day.isToday && <span className="PortalTodayMiniTag">Hôm nay</span>}
                      {day.isCompleted && (
                        <span
                          className="PortalTodayMiniTag"
                          style={{ background: '#10b981' }}
                        >
                          ✓ Đã chốt
                        </span>
                      )}
                      {day.isExtraSession && !day.isCompleted && (
                        <span
                          className="PortalTodayMiniTag"
                          style={{ background: '#7c3aed' }}
                        >
                          Xếp bổ sung
                        </span>
                      )}
                    </div>

                    {day.isCancelled ? (
                      <span
                        className="PortalDayRestTag"
                        style={{ background: '#fee2e2', color: '#b91c1c' }}
                      >
                        ✕ Đã hủy
                      </span>
                    ) : day.hasSession ? (
                      <span
                        className="PortalDayTimeBadge"
                        style={
                          day.isCompleted
                            ? { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }
                            : undefined
                        }
                      >
                        ⏰ {day.time || 'Báo sau'}
                      </span>
                    ) : (
                      <span className="PortalDayRestTag">Nghỉ ngơi</span>
                    )}
                  </div>

                  {day.isCancelled ? (
                    <div className="PortalDayRestBody" style={{ color: '#b91c1c' }}>
                      <span>✕ Buổi tập ngày này đã báo nghỉ / hủy</span>
                    </div>
                  ) : day.hasSession ? (
                    <div className="PortalDayContent">
                      <div className="PortalDayPtRow">
                        <span>👨‍🏫 HLV:</span>
                        <strong>{day.trainerName}</strong>
                        {day.actualSession && isDoubleSession(day.actualSession) && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              background: '#ede9fe',
                              color: '#6d28d9',
                              padding: '1.5px 7px',
                              borderRadius: '99px',
                              fontSize: '10.5px',
                              fontWeight: 800
                            }}
                          >
                            👥 Ca đôi
                          </span>
                        )}
                      </div>

                      <div
                        className={`PortalDayMuscleBox ${day.workoutType ? 'filled' : 'empty'}`}
                        style={
                          day.isCompleted && day.workoutType
                            ? { background: '#f0fdf4', borderColor: '#bbf7d0' }
                            : undefined
                        }
                      >
                        <div
                          className="PortalDayMuscleTitle"
                          style={day.isCompleted && day.workoutType ? { color: '#15803d' } : undefined}
                        >
                          <span>🏋️</span>
                          <span>
                            {day.workoutType
                              ? day.workoutType
                              : 'Chưa ghi nhóm cơ'}
                          </span>
                        </div>

                        {day.workoutNote && (
                          <div
                            className="PortalDayMuscleNote"
                            style={day.isCompleted ? { borderTopColor: '#bbf7d0' } : undefined}
                          >
                            <strong>Bài tập:</strong> {day.workoutNote}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="PortalDayRestBody">
                      <span>☕ Không có ca tập cố định</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 4. NHẬT KÝ CÁC BUỔI TẬP ĐÃ HOÀN THÀNH */}
          {completedSessions.length > 0 && (
            <section className="PortalSection">
              <div className="PortalSectionHeader">
                <div>
                  <h3 className="PortalSectionTitle">🏆 Nhật Ký Các Buổi Tập Đã Hoàn Thành</h3>
                  <p className="PortalSectionSub">
                    Ghi nhận những buổi tập bạn đã hoàn thành cùng huấn luyện viên
                  </p>
                </div>
                <span className="PortalCountChip chip-emerald">
                  ✅ {completedSessions.length} buổi
                </span>
              </div>

              <div className="PortalJournalGrid">
                {completedSessions.map(s => (
                  <div key={s._id} className="PortalLogCard">
                    <div className="PortalLogTop">
                      <div className="PortalLogDateWrap">
                        <span className="PortalLogCheckIcon">✓</span>
                        <div>
                          <div className="PortalLogDate">{formatHeaderDate(s.date)}</div>
                          <div className="PortalLogMeta">
                            PT: <strong>{getTrainerName(s.trainerId)}</strong> • Giờ: <strong>{s.time || '—'}</strong>
                          </div>
                        </div>
                      </div>

                      <span className="PortalLogStatusPill">Đã hoàn thành</span>
                    </div>

                    {(s.workoutType || s.workoutNote) && (
                      <div className="PortalLogWorkoutBox">
                        {s.workoutType && (
                          <div className="PortalLogWorkoutTitle">
                            🎯 Nhóm cơ: {s.workoutType}
                          </div>
                        )}
                        {s.workoutNote && (
                          <div className="PortalLogWorkoutNote">{s.workoutNote}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ==================== NẾU CHƯA ĐĂNG NHẬP: HIỆN FORM RIÊNG CHO KHÁCH HÀNG & ADMIN/PT ====================
  if (!currentUser) {
    return (
      <div className="AuthBackdrop">
        <div className="AuthCard">
          <img src="/logo.png" alt="Logo" className="AuthLogo" />
          <h2 className="AuthTitle">GYM DINHLE</h2>
          <div className="AuthSub">Fitness Center & Personal Trainer Management</div>

          <div className="AuthTabs">
            <button
              onClick={() => { setAuthMode('CLIENT'); setAuthError(''); }}
              className={`AuthTabBtn ${authMode === 'CLIENT' ? 'active' : ''}`}
            >
              🏋️ Khách Hàng
            </button>
            <button
              onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
              className={`AuthTabBtn ${authMode === 'LOGIN' ? 'active' : ''}`}
            >
              🔐 Admin / PT
            </button>
            <button
              onClick={() => { setAuthMode('REGISTER'); setAuthError(''); }}
              className={`AuthTabBtn ${authMode === 'REGISTER' ? 'active' : ''}`}
            >
              📝 Đăng Ký PT
            </button>
          </div>

          {authError && <div className="AuthErrorBox">⚠️ {authError}</div>}

          {/* FORM RIÊNG DÀNH CHO KHÁCH HÀNG TRA CỨU BẰNG SỐ ĐIỆN THOẠI */}
          {authMode === 'CLIENT' ? (
            <form onSubmit={handleClientLoginSubmit} className="AuthForm">
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  color: '#1e3a8a',
                  lineHeight: 1.4
                }}
              >
                👋 <strong>Dành cho Học Viên Gym DinhLe:</strong> Chỉ cần nhập <strong>số điện thoại (hoặc 4 số cuối)</strong> của bạn để xem lịch tập trong tuần <strong></strong>.
              </div>

              <label className="AuthLabel">
                <span>📱 Số điện thoại của bạn:</span>
                <input
                  type="tel"
                  required
                  placeholder="Nhập SĐT hoặc 4 số cuối"
                  value={clientPhoneInput}
                  onChange={e => setClientPhoneInput(e.target.value)}
                  className="AuthInput"
                  style={{ fontSize: '15px', fontWeight: 700 }}
                />
              </label>

              <button type="submit" disabled={authLoading} className="AuthSubmitBtn">
                {authLoading ? 'Đang tìm thông tin...' : '🔍 Xem Lịch Tập & Giáo Án Của Tôi'}
              </button>
            </form>
          ) : (
            /* FORM ĐĂNG NHẬP / ĐĂNG KÝ CHO ADMIN & PT */
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

              {authMode === 'REGISTER' && (
                <label className="AuthLabel">
                  <span>Mã xác nhận đăng ký PT:</span>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mã xác nhận"
                    value={authForm.registerCode}
                    onChange={e => setAuthForm({ ...authForm, registerCode: e.target.value })}
                    className="AuthInput"
                  />
                </label>
              )}

              <button type="submit" disabled={authLoading} className="AuthSubmitBtn">
                {authLoading
                  ? 'Đang xử lý...'
                  : authMode === 'LOGIN'
                  ? 'Đăng Nhập Quản Lý (Admin / PT)'
                  : 'Tạo Tài Khoản Huấn Luyện Viên'}
              </button>
            </form>
          )}

          <div className="AuthHint">
            {authMode === 'CLIENT' ? (
              <span>
                💡 Nếu chưa cập nhật SĐT, bạn hãy nhắn <strong>Admin hoặc PT</strong> thêm SĐT vào hồ sơ của bạn nhé!
              </span>
            ) : (
              <span>
                👥 <strong>Tài khoản PT:</strong> Có thể bấm vào từng ca tập hoặc lịch tuần để ghi bài tập (Thân trên / Thân dưới) cho học viên.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== ĐÃ ĐĂNG NHẬP ADMIN / PT: GIAO DIỆN CHÍNH ====================
  const isDayLocked = sessions.some(s => s.isLocked);
  const validDaySessions = sessions.filter(s => s.status !== 'CANCELLED');
  const totalValidShifts = validDaySessions.length;
  const totalDoubleShiftsToday = validDaySessions.filter(s => isDoubleSession(s)).length;
  const totalCancelledShifts = sessions.filter(
    s => s.status === 'CANCELLED' && s.clientName !== 'OFF'
  ).length;

  const activeClientsCount = clients.filter(c => c.status === 'ACTIVE').length;
  const pausedClientsCount = clients.filter(c => c.status === 'PAUSED').length;
  const missingPhoneClientsCount = clients.filter(c => !String(c.phone || '').trim()).length;

  // Chuẩn hóa tiếng Việt không dấu để tìm kiếm cực nhanh & chính xác
  const normalizeVi = (str = '') =>
    String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();

  const hasActiveClientFilters =
    filterTrainer !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterDay !== 'ALL' ||
    filterMissingPhone ||
    searchClient.trim() !== '';

  const resetClientFilters = () => {
    setFilterTrainer('ALL');
    setFilterStatus('ALL');
    setFilterDay('ALL');
    setFilterMissingPhone(false);
    setSearchClient('');
    setSortClientMode('DEFAULT');
  };

  // Tìm kiếm thông minh: hỗ trợ tiếng Việt không dấu, nhiều từ khóa, SĐT/4 số cuối, tên PT, giờ tập, nhóm cơ, ghi chú
  const displayedClients = clients
    .filter(c => filterTrainer === 'ALL' || String(c.primaryTrainerId?._id || c.primaryTrainerId) === String(filterTrainer))
    .filter(c => filterStatus === 'ALL' || c.status === filterStatus)
    .filter(c => !filterMissingPhone || !String(c.phone || '').trim())
    .filter(c => {
      if (filterDay === 'ALL') return true;
      const targetDay = Number(filterDay);
      return (c.weeklySchedule || []).some(slot => Number(slot.dayOfWeek) === targetDay);
    })
    .filter(c => {
      const normalizedQuery = normalizeVi(searchClient);
      if (!normalizedQuery) return true;
      const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

      const { cleanNote } = parseClientNoteAndTime(c.packageNote, c.updatedAt);
      const rawPhone = String(c.phone || '');
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const ptName = c.primaryTrainerId?.name || '';
      const scheduleText = (c.weeklySchedule || [])
        .map(s => {
          const dayToken = s.dayOfWeek === 8 ? 'cn chu nhat t8' : `t${s.dayOfWeek} thu ${s.dayOfWeek}`;
          return `${dayToken} ${s.time || ''} ${s.workoutType || ''} ${s.workoutNote || ''}`;
        })
        .join(' ');

      const haystack = normalizeVi(`${c.name} ${rawPhone} ${phoneDigits} ${ptName} ${cleanNote} ${scheduleText}`);
      return tokens.every(token => {
        const tokenDigits = token.replace(/\D/g, '');
        if (haystack.includes(token)) return true;
        if (tokenDigits.length > 0 && phoneDigits.includes(tokenDigits)) return true;
        return false;
      });
    })
    .sort((a, b) => {
      if (sortClientMode === 'RECENT') {
        const timeA = parseClientNoteAndTime(a.packageNote, a.updatedAt).updatedAt;
        const timeB = parseClientNoteAndTime(b.packageNote, b.updatedAt).updatedAt;
        const msA = timeA ? new Date(timeA).getTime() : 0;
        const msB = timeB ? new Date(timeB).getTime() : 0;
        return msB - msA;
      }
      if (sortClientMode === 'NAME_ASC') {
        return (a.name || '').localeCompare(b.name || '', 'vi');
      }
      if (sortClientMode === 'MOST_SESSIONS') {
        return (b.weeklySchedule?.length || 0) - (a.weeklySchedule?.length || 0);
      }
      return 0;
    });

  const currentMonthInfo = getMonthRange(selectedMonth);

  // Dữ liệu Tab 3: Sắp xếp chốt ca đúng thứ tự ngày tăng dần
  const formatShortDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const jsDay = new Date(y, m - 1, d).getDay();
    const dayLabel = jsDay === 0 ? 'CN' : `T${jsDay + 1}`;
    return `${dayLabel}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  };

  const formatVNDate = (dateStr) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const summaryByTrainer = trainers.map(trainer => {
    const item = weeklySummary.find(w => String(w._id) === String(trainer._id));
    const sortedDays = [...(item?.dailyBreakdown || [])].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );
    return {
      trainer,
      totalShifts: item ? item.totalShifts : 0,
      totalDoubleShifts: item?.totalDoubleShifts || 0,
      dailyBreakdown: sortedDays
    };
  });

  const grandTotalShifts = summaryByTrainer.reduce((sum, x) => sum + x.totalShifts, 0);
  const grandTotalDouble = summaryByTrainer.reduce((sum, x) => sum + x.totalDoubleShifts, 0);
  const activeTrainerCount = summaryByTrainer.filter(x => x.totalShifts > 0).length;
  const maxTrainerShifts = Math.max(1, ...summaryByTrainer.map(x => x.totalShifts));
  const allClosedDatesSorted = Array.from(
    new Set(summaryByTrainer.flatMap(x => x.dailyBreakdown.map(d => d.date)))
  ).sort((a, b) => a.localeCompare(b));

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
              {/* BANNER TIÊU ĐỀ LỊCH NGÀY HIỆN ĐẠI */}
              <div className="BoardBanner">
                <div className="BannerTitleWrap">
                  <span className="BannerIconBox">📅</span>
                  <div>
                    <div className="BannerTitle">Lịch PT — {formatHeaderDate(selectedDate)}</div>
                    <div className="BannerSubHint">
                      {isAdmin
                        ? 'Kéo thả thẻ giữa các cột để đổi PT • Bấm vào thẻ để chỉnh sửa hoặc ghi bài tập'
                        : 'Bấm vào từng ca tập để ghi nhóm cơ & giáo án cho học viên'}
                    </div>
                  </div>
                </div>

                <div className="BannerStats">
                  <span className="StatPill pill-blue">
                    Tổng chốt: <strong>{totalValidShifts} ca</strong>
                  </span>
                  {totalDoubleShiftsToday > 0 && (
                    <span className="StatPill pill-purple">
                      👥 Ca đôi: <strong>{totalDoubleShiftsToday}</strong>
                    </span>
                  )}
                  <span className="StatPill pill-red">
                    Hủy: <strong>{totalCancelledShifts}</strong>
                  </span>
                  <span className={`StatPill ${isDayLocked ? 'pill-locked' : 'pill-open'}`}>
                    {isDayLocked ? '🔒 Đã chốt sổ' : '🔓 Đang mở'}
                  </span>

                  <button
                    onClick={() => setIsFullscreenBoard(!isFullscreenBoard)}
                    className="Btn BtnDark"
                    style={{ padding: '5px 11px', fontSize: '11.5px' }}
                  >
                    {isFullscreenBoard ? '✕ Thoát Full' : '⛶ Full Màn Hình'}
                  </button>
                </div>
              </div>

              {/* CHẾ ĐỘ 1: BẢNG NGANG (MA TRẬN HIỆN ĐẠI) */}
              {dailyLayout === 'BOARD' ? (
                <div className="TableScrollBox">
                  <table className="MatrixTable">
                    <thead>
                      <tr>
                        <th className="StickyCol StickyCorner">Ca</th>
                        {trainers.map(trainer => {
                          const isOff = sessions.some(
                            s => s.trainerId === trainer._id && s.clientName === 'OFF'
                          );
                          const validCountHeader = sessions.filter(
                            s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
                          ).length;
                          const trainerVisual = getTrainerVisualInfo({ isOff, validCount: validCountHeader });

                          return (
                            <th key={trainer._id} className={`ThTrainer ${isOff ? 'trainer-is-off' : ''}`}>
                              <div className="ThTrainerTop">
                                <div className="ThTrainerNameGroup">
                                  <span
                                    className={`HeaderMiniIcon variant-${trainerVisual.variant}`}
                                    title={trainerVisual.label}
                                  >
                                    {trainerVisual.renderIcon(13)}
                                  </span>
                                  <span className="TrainerName" title={trainer.name}>{trainer.name}</span>
                                </div>
                                <span className={`HeaderMiniCount ${validCountHeader > 0 ? 'has-shift' : ''}`}>
                                  {validCountHeader}
                                </span>
                              </div>
                              <div className="TrainerActionRow">
                                {isAdmin ? (
                                  <>
                                    <button
                                      onClick={() => openQuickAddForTrainer(trainer._id)}
                                      className="MiniTagBtn btn-add-ca"
                                    >
                                      + Ca
                                    </button>
                                    <button
                                      onClick={() => handleToggleTrainerOff(trainer._id)}
                                      className={`MiniTagBtn btn-off-ca ${isOff ? 'active-off' : ''}`}
                                    >
                                      {isOff ? 'Đang OFF' : 'OFF'}
                                    </button>
                                  </>
                                ) : (
                                  <span className={`PtRoleHint ${isOff ? 'is-off' : ''}`}>
                                    {isOff ? 'Nghỉ phép (OFF)' : 'Chạm ca để ghi bài'}
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
                        <tr key={rowIndex} className="MatrixRow">
                          <td className="StickyCol">
                            <span className="RowIndexNum">{rowIndex + 1}</span>
                          </td>

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
                                className="MatrixCell"
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
                                    title={cellSession.workoutNote ? `Bài tập: ${cellSession.workoutNote}` : 'Bấm để xếp ca / ghi bài tập'}
                                  >
                                    {isOffMarker ? (
                                      <span className="OffMarkerText">
                                        ⏸ NGHỈ PHÉP (OFF)
                                      </span>
                                    ) : isDouble ? (
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

                                        {(cellSession.workoutType || cellSession.workoutNote) && (
                                          <div className="MiniWorkoutBadge">
                                            🏋️ {cellSession.workoutType || 'Có bài tập'}
                                          </div>
                                        )}

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

                                        {(cellSession.workoutType || cellSession.workoutNote) && (
                                          <div className="MiniWorkoutBadge">
                                            🏋️ {cellSession.workoutType || 'Có bài tập'}
                                          </div>
                                        )}

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
                        <td className="StickyCol FooterSticky">
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
                                <span className={`FooterCountBadge ${validCount === 0 ? 'zero-count' : ''}`}>
                                  {validCount}
                                </span>
                                {doubleCount > 0 && (
                                  <span className="FooterDoubleNote">
                                    👥 {doubleCount} ca đôi
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
                /* CHẾ ĐỘ 2: THẺ THEO TỪNG PT (ICON VECTOR SVG TỐI GIẢN THEO TRẠNG THÁI) */
                <div className="TrainerCardsGrid">
                  {trainers.map(trainer => {
                    const ptSessions = getSortedTrainerSessions(trainer._id);
                    const validList = ptSessions.filter(s => s.status !== 'CANCELLED');
                    const validCount = validList.length;
                    const doubleCount = validList.filter(s => isDoubleSession(s)).length;
                    const isOff = ptSessions.some(s => s.clientName === 'OFF');
                    const trainerVisual = getTrainerVisualInfo({ isOff, validCount });

                    return (
                      <div
                        key={trainer._id}
                        className={`PTCard ${ptSessions.length === 0 ? 'pt-card-empty' : ''} ${isOff ? 'pt-card-off' : ''}`}
                      >
                        <div className="PTCardHeader">
                          <div className="PTCardTitleRow">
                            <div className="PTCardIdentity">
                              <span
                                className={`PTAvatar variant-${trainerVisual.variant}`}
                                title={trainerVisual.label}
                              >
                                {trainerVisual.renderIcon(18)}
                              </span>
                              <strong className="PTCardName" title={trainer.name}>
                                {trainer.name}
                              </strong>
                            </div>

                            {isAdmin && (
                              <div className="PTCardActions">
                                <button
                                  onClick={() => openQuickAddForTrainer(trainer._id)}
                                  className="MiniTagBtn btn-add-ca"
                                >
                                  + Ca
                                </button>
                                <button
                                  onClick={() => handleToggleTrainerOff(trainer._id)}
                                  className={`MiniTagBtn btn-off-ca ${isOff ? 'active-off' : ''}`}
                                >
                                  {isOff ? 'Đang OFF' : 'OFF'}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="PTCardMetaRow">
                            <span className={`PTCountPill ${validCount === 0 ? 'zero' : ''}`}>
                              {validCount > 0 ? `● Chốt: ${validCount} ca` : '○ 0 ca'}
                            </span>
                            {doubleCount > 0 && (
                              <span className="PTDoublePill">
                                👥 {doubleCount} ca đôi
                              </span>
                            )}
                            {isOff && (
                              <span className="PTOffPill">⏸ Đang nghỉ phép</span>
                            )}
                          </div>
                        </div>

                        {ptSessions.length === 0 ? (
                          <div className="PTCardEmptyBody">
                            <span>☕ Chưa có lịch tập hôm nay</span>
                          </div>
                        ) : (
                          <div className="PTCardSessionList">
                            {ptSessions.map((cellSession, idx) => {
                              const isOffMarker = cellSession.clientName === 'OFF';
                              const isCancelled = cellSession.status === 'CANCELLED' && !isOffMarker;
                              const isCompleted = cellSession.status === 'COMPLETED';
                              const isDouble = isDoubleSession(cellSession);
                              return (
                                <div
                                  key={cellSession._id}
                                  onClick={() => openEditModal(cellSession)}
                                  className={`SessionCard PTListCard ${isDouble ? 'double-shift' : ''} ${
                                    isOffMarker ? 'off' : ''
                                  } ${isCancelled ? 'cancelled' : ''} ${
                                    isCompleted ? 'completed' : ''
                                  }`}
                                >
                                  {isOffMarker ? (
                                    <span className="OffMarkerText">
                                      ⏸ NGHỈ PHÉP (OFF)
                                    </span>
                                  ) : (
                                    <div className="PTListInner">
                                      <div className="PTListMainRow">
                                        <div className="PTListLeft">
                                          <span className="PTIndexBadge">{idx + 1}</span>
                                          <div className="PTListNameWrap">
                                            {isDouble && (
                                              <span className="DoubleBadge" style={{ marginRight: '5px' }}>
                                                👥 Ca đôi
                                              </span>
                                            )}
                                            <span
                                              className="ClientTitle"
                                              style={{
                                                textDecoration: isCancelled ? 'line-through' : 'none'
                                              }}
                                            >
                                              {getCleanSessionName(cellSession.clientName)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="PTListRight">
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

                                      {(cellSession.workoutType || cellSession.workoutNote) && (
                                        <div className="MiniWorkoutBadge">
                                          🏋️ {cellSession.workoutType || 'Bài tập'}
                                          {cellSession.workoutNote ? `: ${cellSession.workoutNote}` : ''}
                                        </div>
                                      )}
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

      {/* ==================== TAB 2: QUẢN LÝ LỊCH TUẦN, SĐT & GHI BÀI TẬP (TỐI ƯU GIAO DIỆN & TÌM KIẾM) ==================== */}
      {activeTab === 'CLIENTS' && (
        <div className="MainArea">
          {/* BẢNG ĐIỀU KHIỂN & TÌM KIẾM THÔNG MINH */}
          <div className="ClientsControlPanel">
            {/* Tầng 1: Ô tìm kiếm thông minh + Nút thao tác Admin */}
            <div className="ClientsTopRow">
              <div className="SmartSearchWrap">
                <span className="SmartSearchIcon">🔍</span>
                <input
                  type="text"
                  placeholder="Tìm nhanh không dấu: tên khách, SĐT/4 số cuối, tên PT, giờ (7h15), thứ (T2), nhóm cơ..."
                  value={searchClient}
                  onChange={e => setSearchClient(e.target.value)}
                  className="SmartSearchInput"
                />
                {searchClient && (
                  <button
                    type="button"
                    onClick={() => setSearchClient('')}
                    className="SmartSearchClear"
                    title="Xóa từ khóa"
                  >
                    ✕
                  </button>
                )}
                <span className="SearchResultCountBadge">
                  {displayedClients.length}/{clients.length}
                </span>
              </div>

              {isAdmin && (
                <div className="ClientsAdminActions">
                  <button
                    onClick={handlePauseAllClients}
                    className="Btn BtnOrange"
                    title="Chuyển toàn bộ khách hàng sang Tạm nghỉ (OFF) để kiểm tra ai tập tuần mới"
                  >
                    ⏸ Chuyển Toàn Bộ OFF
                  </button>

                  <button
                    onClick={() =>
                      setEditingClient({
                        name: '',
                        phone: '',
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

            {/* Tầng 2: Thẻ lọc trạng thái nhanh + Bộ lọc PT / Thứ trong tuần / Sắp xếp */}
            <div className="ClientsBottomRow">
              <div className="QuickFilterPills">
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('ALL');
                    setFilterMissingPhone(false);
                  }}
                  className={`QuickPill ${filterStatus === 'ALL' && !filterMissingPhone ? 'active' : ''}`}
                >
                  Tất cả <span>{clients.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('ACTIVE');
                    setFilterMissingPhone(false);
                  }}
                  className={`QuickPill pill-green ${filterStatus === 'ACTIVE' && !filterMissingPhone ? 'active' : ''}`}
                >
                  ● Đang tập <span>{activeClientsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('PAUSED');
                    setFilterMissingPhone(false);
                  }}
                  className={`QuickPill pill-amber ${filterStatus === 'PAUSED' && !filterMissingPhone ? 'active' : ''}`}
                >
                  ⏸ Tạm nghỉ <span>{pausedClientsCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMissingPhone(!filterMissingPhone)}
                  className={`QuickPill pill-rose ${filterMissingPhone ? 'active' : ''}`}
                  title="Lọc nhanh các hội viên chưa cập nhật SĐT để nhắn bổ sung"
                >
                  📵 Thiếu SĐT <span>{missingPhoneClientsCount}</span>
                </button>
              </div>

              <div className="ClientsSelectFilters">
                <select
                  value={filterTrainer}
                  onChange={e => setFilterTrainer(e.target.value)}
                  className="CleanSelect"
                >
                  <option value="ALL">👨‍🏫 Tất cả PT</option>
                  {trainers.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>

                <select
                  value={filterDay}
                  onChange={e => setFilterDay(e.target.value)}
                  className="CleanSelect"
                >
                  <option value="ALL">📅 Tất cả các thứ</option>
                  {DAYS.map(d => (
                    <option key={d.num} value={d.num}>Tập {d.label}</option>
                  ))}
                </select>

                <select
                  value={sortClientMode}
                  onChange={e => setSortClientMode(e.target.value)}
                  className="CleanSelect"
                >
                  <option value="DEFAULT">📑 Sắp xếp: Mặc định</option>
                  <option value="RECENT">🕒 Mới sửa gần nhất</option>
                  <option value="NAME_ASC">🔤 Tên A → Z</option>
                  <option value="MOST_SESSIONS">🔥 Nhiều buổi/tuần nhất</option>
                </select>

                {hasActiveClientFilters && (
                  <button
                    type="button"
                    onClick={resetClientFilters}
                    className="ResetFilterBtn"
                    title="Xóa toàn bộ bộ lọc đang áp dụng"
                  >
                    ↺ Đặt lại
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* DANH SÁCH THẺ KHÁCH HÀNG (ICON VECTOR SVG THEO TRẠNG THÁI & LOẠI KHÁCH) */}
          {displayedClients.length === 0 ? (
            <div className="ClientsEmptyBox">
              <div className="ClientsEmptyIcon">🔎</div>
              <div className="ClientsEmptyTitle">Không tìm thấy học viên nào phù hợp</div>
              <div className="ClientsEmptySub">
                Thử gõ từ khóa ngắn hơn (không cần dấu), kiểm tra lại bộ lọc PT hoặc thứ trong tuần.
              </div>
              {hasActiveClientFilters && (
                <button type="button" onClick={resetClientFilters} className="Btn BtnBlue" style={{ marginTop: '10px' }}>
                  ↺ Xóa toàn bộ bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="ClientsGridV2">
              {displayedClients.map(client => {
                const { cleanNote, updatedAt } = parseClientNoteAndTime(
                  client.packageNote,
                  client.updatedAt
                );
                const formattedTime = formatUpdateTime(updatedAt);
                const isActive = client.status === 'ACTIVE';
                const sortedSlots = [...(client.weeklySchedule || [])].sort(
                  (a, b) => a.dayOfWeek - b.dayOfWeek
                );
                const clientVisual = getClientVisualInfo(client);

                return (
                  <div
                    key={client._id}
                    className={`ClientCardV2 variant-${clientVisual.variant} ${isActive ? 'is-active' : 'is-paused'}`}
                  >
                    {/* Header: Icon Vector SVG + Tên + Trạng thái */}
                    <div className="ClientCardV2Header">
                      <div className="ClientCardV2Identity">
                        <span
                          className={`ClientAvatar variant-${clientVisual.variant}`}
                          title={clientVisual.label}
                        >
                          {clientVisual.renderIcon(18)}
                        </span>
                        <div className="ClientNameBlock">
                          <div className="ClientNameText" title={client.name}>
                            {client.name}
                          </div>
                          <div className="ClientPtLine">
                            PT: <strong>{client.primaryTrainerId?.name || '—'}</strong>
                            <span className="ClientSessionDot">•</span>
                            <span>{sortedSlots.length} buổi/tuần</span>
                          </div>
                        </div>
                      </div>

                      <span className={`ClientStatusPill ${isActive ? 'active' : 'paused'}`}>
                        {isActive ? '● Đang tập' : '⏸ OFF'}
                      </span>
                    </div>

                    {/* Thông tin SĐT */}
                    <div className={`ClientPhoneRow ${client.phone ? 'has-phone' : 'missing-phone'}`}>
                      <span>📱</span>
                      {client.phone ? (
                        <strong>{client.phone}</strong>
                      ) : (
                        <span>Chưa cập nhật SĐT</span>
                      )}
                    </div>

                    {/* Lịch tập trong tuần */}
                    <div className="ClientSlotsWrap">
                      {sortedSlots.length > 0 ? (
                        sortedSlots.map((slot, idx) => (
                          <div
                            key={idx}
                            className={`ClientSlotChip ${slot.workoutType ? 'has-workout' : ''}`}
                          >
                            <span className="SlotDayLabel">
                              {slot.dayOfWeek === 8 ? 'CN' : `T${slot.dayOfWeek}`}
                            </span>
                            <span className="SlotTimeLabel">{slot.time || 'Báo sau'}</span>
                            {slot.workoutType && (
                              <span className="SlotWorkoutLabel">{slot.workoutType}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="NoSlotsHint">Chưa xếp buổi tập cố định trong tuần</span>
                      )}
                    </div>

                    {cleanNote && (
                      <div className="ClientNoteChip" title={cleanNote}>
                        📌 {cleanNote}
                      </div>
                    )}

                    {/* Footer gọn: Thời gian sửa + Nút hành động */}
                    <div className="ClientCardV2Footer">
                      <span
                        className={`ClientTimeStamp ${formattedTime ? 'edited' : ''}`}
                        title={formattedTime ? `Chỉnh sửa lần cuối: ${formattedTime}` : 'Chưa có lịch sử sửa'}
                      >
                        🕒 {formattedTime ? formattedTime.replace(' — ', ' • ') : 'Chưa sửa'}
                      </span>

                      <button
                        onClick={() =>
                          setEditingClient({
                            ...client,
                            phone: client.phone || '',
                            packageNote: cleanNote,
                            lastModifiedDisplay: formattedTime,
                            primaryTrainerId: client.primaryTrainerId?._id || client.primaryTrainerId
                          })
                        }
                        className="ClientEditBtn"
                      >
                        {isAdmin ? '✏️ Sửa lịch / SĐT' : '🏋️ Ghi bài tập'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: TỔNG HỢP & DỌN DẸP THEO THÁNG ==================== */}
      {activeTab === 'SUMMARY' && (
        <div className="MainArea">
          {/* KHUNG ĐIỀU KHIỂN GỘP GỌN: LỌC THÁNG / KHOẢNG NGÀY / XUẤT EXCEL / DỌN DỮ LIỆU */}
          <div className="SummaryControlPanel">
            <div className="SummaryControlRow">
              <div className="SummaryFilterGroup">
                <span className="SummaryFilterLabel">🗓 Tháng:</span>
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
                  Xem cả {currentMonthInfo.label}
                </button>
                <button
                  onClick={() => {
                    const wk = getCurrentWeekRange();
                    setStartDate(wk.start);
                    setEndDate(wk.end);
                    loadWeeklySummary(wk.start, wk.end);
                  }}
                  className="Btn BtnLight"
                >
                  Tuần này
                </button>
              </div>

              <div className="SummaryFilterGroup">
                <span className="SummaryFilterLabel">Từ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={styles.input}
                />
                <span className="SummaryFilterLabel">Đến:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={styles.input}
                />
                <button
                  onClick={() => loadWeeklySummary(startDate, endDate)}
                  className="Btn BtnBlue"
                >
                  🔍 Lọc
                </button>
              </div>
            </div>

            <div className="SummaryControlRow SummaryControlBottom">
              <div className="SummaryViewSwitch">
                <button
                  onClick={() => setSummaryViewMode('CARDS')}
                  className={`SummarySwitchBtn ${summaryViewMode === 'CARDS' ? 'active' : ''}`}
                >
                  🗂 Dạng Thẻ PT
                </button>
                <button
                  onClick={() => setSummaryViewMode('TABLE')}
                  className={`SummarySwitchBtn ${summaryViewMode === 'TABLE' ? 'active' : ''}`}
                >
                  📋 Bảng Đối Chiếu Ngày
                </button>
              </div>

              <div className="SummaryFilterGroup">
                <button onClick={exportWeeklyToExcel} className="Btn BtnEmerald">
                  📥 Xuất Excel ({formatVNDate(startDate).slice(0, 5)} → {formatVNDate(endDate).slice(0, 5)})
                </button>

                {isAdmin && (
                  <button onClick={handleDeleteMonthSessions} className="Btn BtnRed">
                    🗑 Xóa Chốt Ca {currentMonthInfo.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* THANH KPI TỔNG QUAN */}
          <div className="SummaryKpiGrid">
            <div className="SummaryKpiCard kpi-blue">
              <span className="SummaryKpiLabel">Tổng Ca Đã Chốt</span>
              <strong className="SummaryKpiValue">{grandTotalShifts} ca</strong>
            </div>
            <div className="SummaryKpiCard kpi-purple">
              <span className="SummaryKpiLabel">Tổng Ca Đôi</span>
              <strong className="SummaryKpiValue">{grandTotalDouble} ca đôi</strong>
            </div>
            <div className="SummaryKpiCard kpi-green">
              <span className="SummaryKpiLabel">PT Có Ca Chốt</span>
              <strong className="SummaryKpiValue">
                {activeTrainerCount} / {trainers.length} PT
              </strong>
            </div>
            <div className="SummaryKpiCard kpi-slate">
              <span className="SummaryKpiLabel">Kỳ Đang Xem ({allClosedDatesSorted.length} ngày chốt)</span>
              <strong className="SummaryKpiValue" style={{ fontSize: '15px' }}>
                {formatVNDate(startDate)} → {formatVNDate(endDate)}
              </strong>
            </div>
          </div>

          {/* CHẾ ĐỘ 1: DẠNG THẺ PT (ĐÃ SẮP XẾP ĐÚNG THỨ TỰ NGÀY & THẲNG CỘT) */}
          {summaryViewMode === 'CARDS' ? (
            <div className="SummaryCardsGrid">
              {summaryByTrainer.map(({ trainer, totalShifts, totalDoubleShifts, dailyBreakdown }) => {
                const barPercent = totalShifts > 0 ? Math.max(8, Math.round((totalShifts / maxTrainerShifts) * 100)) : 0;
                const trainerVisual = getTrainerVisualInfo({ isOff: false, validCount: totalShifts });

                return (
                  <div
                    key={trainer._id}
                    className={`SummaryPTCard ${totalShifts === 0 ? 'empty-pt' : ''}`}
                  >
                    <div className="SummaryPTHeader">
                      <div className="SummaryPTIdentity">
                        <span
                          className={`PTAvatar variant-${trainerVisual.variant}`}
                          title={trainerVisual.label}
                        >
                          {trainerVisual.renderIcon(17)}
                        </span>
                        <div>
                          <div className="SummaryPTName">{trainer.name}</div>
                          <div className="SummaryPTSub">
                            {dailyBreakdown.length > 0
                              ? `${dailyBreakdown.length} ngày có ca chốt`
                              : 'Chưa phát sinh ca chốt'}
                          </div>
                        </div>
                      </div>

                      <div className="SummaryPTBadges">
                        {totalDoubleShifts > 0 && (
                          <span className="SummaryDoublePill">
                            👥 {totalDoubleShifts} ca đôi
                          </span>
                        )}
                        <span
                          className={`SummaryTotalPill ${totalShifts === 0 ? 'zero' : ''}`}
                        >
                          {totalShifts} ca
                        </span>
                      </div>
                    </div>

                    <div className="SummaryProgressTrack">
                      <div
                        className="SummaryProgressFill"
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>

                    {dailyBreakdown.length > 0 ? (
                      <div className="SummaryDayList">
                        {dailyBreakdown.map(d => (
                          <div key={d.date} className="SummaryDayRow">
                            <span className="SummaryDayDate">
                              📅 {formatShortDate(d.date)}
                            </span>
                            <div className="SummaryDayRight">
                              {d.doubleCount > 0 && (
                                <span className="SummaryDayDoubleTag">
                                  {d.doubleCount} ca đôi
                                </span>
                              )}
                              <span className="SummaryDayCount">{d.count} ca</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="SummaryEmptyState">
                        Chưa có ngày chốt ca trong khoảng thời gian này
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* CHẾ ĐỘ 2: BẢNG ĐỐI CHIẾU THEO TỪNG NGÀY TĂNG DẦN */
            <div className="BoardCard" style={{ marginTop: '12px' }}>
              <div className="TableScrollBox">
                <table className="SummaryMatrixTable">
                  <thead>
                    <tr>
                      <th className="SummaryStickyPT">Huấn Luyện Viên</th>
                      {allClosedDatesSorted.map(dateStr => (
                        <th key={dateStr} className="SummaryThDate">
                          {formatShortDate(dateStr)}
                        </th>
                      ))}
                      <th className="SummaryThTotal">Ca Đôi</th>
                      <th className="SummaryThTotal">Tổng Ca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryByTrainer.map(({ trainer, totalShifts, totalDoubleShifts, dailyBreakdown }) => (
                      <tr key={trainer._id}>
                        <td className="SummaryStickyPT">{trainer.name}</td>
                        {allClosedDatesSorted.map(dateStr => {
                          const found = dailyBreakdown.find(d => d.date === dateStr);
                          return (
                            <td key={dateStr} className="SummaryTdCell">
                              {found ? (
                                <div className="SummaryCellStack">
                                  <strong>{found.count}</strong>
                                  {found.doubleCount > 0 && (
                                    <span className="SummaryCellDbl">+{found.doubleCount} đôi</span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="SummaryTdCell">
                          {totalDoubleShifts > 0 ? (
                            <span className="SummaryDayDoubleTag">{totalDoubleShifts}</span>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>0</span>
                          )}
                        </td>
                        <td className="SummaryTdTotal">{totalShifts}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="SummaryFooterTr">
                      <td className="SummaryStickyPT" style={{ background: '#0f172a', color: '#fff' }}>
                        Tổng Cộng
                      </td>
                      {allClosedDatesSorted.map(dateStr => {
                        const daySum = summaryByTrainer.reduce((acc, x) => {
                          const found = x.dailyBreakdown.find(d => d.date === dateStr);
                          return acc + (found ? found.count : 0);
                        }, 0);
                        return (
                          <td key={dateStr} style={{ textAlign: 'center', fontWeight: 800 }}>
                            {daySum}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', color: '#fde047', fontWeight: 800 }}>
                        {grandTotalDouble}
                      </td>
                      <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 900, fontSize: '14px' }}>
                        {grandTotalShifts}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
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
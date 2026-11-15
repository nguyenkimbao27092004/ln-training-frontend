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

  const [activeTab, setActiveTab] = useState('DAILY');
  const [dailyLayout, setDailyLayout] = useState('BOARD');
  const [isFullscreenBoard, setIsFullscreenBoard] = useState(false);

  const [trainers, setTrainers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [sessions, setSessions] = useState([]);
  const [autoSortTime] = useState(true);

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
  const [sortClientMode, setSortClientMode] = useState('DEFAULT');
  const [editingClient, setEditingClient] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth);
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [weeklySummary, setWeeklySummary] = useState([]);

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

  const handleSelectFullMonth = (ymStr) => {
    setSelectedMonth(ymStr);
    const { start, end } = getMonthRange(ymStr);
    setStartDate(start);
    setEndDate(end);
    loadWeeklySummary(start, end);
  };

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
                            const nameParts = cellSession ? splitDoubleClientNames(cellSession.clientName) : [];

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
                                    ) : isDouble ? (
                                      <>
                                        <div className="DoubleTopBar">
                                          <span className="DoubleBadge">👥 Ca đôi</span>
                                          <div className="DoubleRightControls">
                                            <span className="TimePill">{cellSession.time || 'h'}</span>
                                            {!cellSession.isLocked && (
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
                                      </>
                                    ) : (
                                      <div className="SingleRowLayout">
                                        <span
                                          className="ClientTitle"
                                          style={{
                                            textDecoration: isCancelled ? 'line-through' : 'none'
                                          }}
                                        >
                                          {getCleanSessionName(cellSession.clientName)}
                                        </span>

                                        <div className="DoubleRightControls">
                                          <span className="TimePill">
                                            {cellSession.time || 'h'}
                                          </span>
                                          {!cellSession.isLocked && (
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
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

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

                                      <div className="DoubleRightControls">
                                        <span className="TimePill">{cellSession.time || 'h'}</span>
                                        {!cellSession.isLocked && (
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

      {/* ==================== 3 HỘP THOẠI MODAL TÁCH RIÊNG ==================== */}
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
      />
    </div>
  );
}
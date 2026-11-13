import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = 'http://localhost:5000/api';
const DAYS = [
  { num: 2, label: 'Thứ 2' },
  { num: 3, label: 'Thứ 3' },
  { num: 4, label: 'Thứ 4' },
  { num: 5, label: 'Thứ 5' },
  { num: 6, label: 'Thứ 6' },
  { num: 7, label: 'Thứ 7' },
  { num: 8, label: 'Chủ Nhật' }
];

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 9999;
  const match = timeStr.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/i);
  if (!match) return 9999;
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('DAILY');
  const [trainers, setTrainers] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2026-11-09');
  const [sessions, setSessions] = useState([]);
  const [autoSortTime, setAutoSortTime] = useState(true);

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

  const [startDate, setStartDate] = useState('2026-11-09');
  const [endDate, setEndDate] = useState('2026-11-15');
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

  const getSortedTrainerSessions = (trainerId) => {
    const list = sessions.filter(s => s.trainerId === trainerId);
    if (!autoSortTime) return list;
    return [...list].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  };

  // Tự động tính số dòng: tối thiểu 10 dòng, nếu PT có trên 10 khách sẽ tự động cộng thêm dòng
  const maxSessionsInColumn = trainers.reduce((max, trainer) => {
    const count = sessions.filter(s => s.trainerId === trainer._id).length;
    return Math.max(max, count);
  }, 0);
  const dynamicRowCount = Math.max(10, maxSessionsInColumn + 1);

  const formatHeaderDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const jsDay = new Date(y, m - 1, d).getDay();
    const dayLabel = jsDay === 0 ? 'Chủ Nhật' : `Thứ ${jsDay + 1}`;
    return `Lịch PT (${dayLabel} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')})`;
  };

  // Xuất Bảng Lịch Ngày ra tệp Excel (.xlsx)
  const exportDailyToExcel = () => {
    const aoa = [];
    aoa.push([formatHeaderDate(selectedDate)]);
    aoa.push(['Ca / PT', ...trainers.map(t => t.name)]);

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
    ws['!cols'] = [{ wch: 10 }, ...trainers.map(() => ({ wch: 24 }))];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: trainers.length } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lich_PT_${selectedDate}`);
    XLSX.writeFile(wb, `Lich_PT_${selectedDate}.xlsx`);
  };

  // Xuất Bảng Tổng Hợp Tuần ra tệp Excel (.xlsx)
  const exportWeeklyToExcel = () => {
    const aoa = [
      [`BÁO CÁO TỔNG HỢP CA PT (${startDate} đến ${endDate})`],
      ['Huấn Luyện Viên (PT)', 'Chi Tiết Các Ngày Đã Chốt', 'Tổng Số Ca Tuần']
    ];

    trainers.forEach(trainer => {
      const item = weeklySummary.find(w => w._id === trainer._id);
      const detailStr = item?.dailyBreakdown
        ?.map(d => `${d.date.slice(5)}: ${d.count} ca`)
        .join(', ') || 'Chưa có ca chốt';
      aoa.push([trainer.name, detailStr, item ? item.totalShifts : 0]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 24 }, { wch: 48 }, { wch: 18 }];
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
  const totalCancelledShifts = sessions.filter(s => s.status === 'CANCELLED' && s.clientName !== 'OFF').length;
  const totalOffTrainers = sessions.filter(s => s.clientName === 'OFF').length;

  return (
    <div style={styles.page}>
      {/* Header hiện đại */}
      <header style={styles.header}>
        <div style={styles.brandGroup}>
          <div style={styles.logoBadge}>LN</div>
          <div>
            <h1 style={styles.title}>LN TRAINING — QUẢN LÝ LỊCH & CHỐT CA PT</h1>
            <p style={styles.subtitle}>
              Tự động co giãn số dòng khi vượt 10 ca/ngày • Kéo thả đổi PT • Xuất báo cáo Excel
            </p>
          </div>
        </div>

        <div style={styles.navPills}>
          <button
            onClick={() => setActiveTab('DAILY')}
            style={activeTab === 'DAILY' ? styles.pillActive : styles.pillBtn}
          >
            📅 Lịch Mỗi Ngày
          </button>
          <button
            onClick={() => setActiveTab('CLIENTS')}
            style={activeTab === 'CLIENTS' ? styles.pillActive : styles.pillBtn}
          >
            👥 Lịch Tuần ({clients.length})
          </button>
          <button
            onClick={() => { setActiveTab('SUMMARY'); loadWeeklySummary(); }}
            style={activeTab === 'SUMMARY' ? styles.pillActive : styles.pillBtn}
          >
            📊 Tổng Hợp Tuần
          </button>
        </div>
      </header>

      {/* ==================== TAB 1: LỊCH MỖI NGÀY ==================== */}
      {activeTab === 'DAILY' && (
        <main style={styles.mainContent}>
          {/* 4 Thẻ thống kê nhanh trong ngày */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Ngày đang chọn</span>
              <strong style={styles.statValue}>{formatHeaderDate(selectedDate).replace('Lịch PT ', '')}</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Tổng ca tính công</span>
              <strong style={{ ...styles.statValue, color: '#2563eb' }}>{totalValidShifts} ca</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Khách báo hủy (Gạch ca)</span>
              <strong style={{ ...styles.statValue, color: '#e11d48' }}>{totalCancelledShifts} ca</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Trạng thái sổ cuối ngày</span>
              <strong style={{ ...styles.statValue, color: isDayLocked ? '#16a34a' : '#d97706' }}>
                {isDayLocked ? '🔒 Đã chốt sổ' : `🔓 Đang mở (${totalOffTrainers} PT OFF)`}
              </strong>
            </div>
          </div>

          {/* Thanh công cụ thao tác */}
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <div style={styles.datePickerWrap}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Ngày:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={styles.dateInput}
                />
              </div>

              <button
                onClick={() => openQuickAddForTrainer(trainers[0]?._id || '')}
                style={styles.btnPrimary}
              >
                + Thêm Ca Tập Mới
              </button>

              <button onClick={handleResyncFromWeekly} style={styles.btnOutline}>
                🔄 Đồng Bộ Từ Lịch Tuần
              </button>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={autoSortTime}
                  onChange={e => setAutoSortTime(e.target.checked)}
                />
                Sắp xếp ca từ sáng đến tối
              </label>
            </div>

            <div style={styles.toolbarRight}>
              <button onClick={exportDailyToExcel} style={styles.btnExcel}>
                📥 Xuất Excel Ngày
              </button>

              {!isDayLocked ? (
                <button onClick={handleCloseDay} style={styles.btnSuccess}>
                  ✅ Chốt Ca Cuối Ngày
                </button>
              ) : (
                <button onClick={handleReopenDay} style={styles.btnWarning}>
                  🔓 Mở Khóa Sửa Lịch
                </button>
              )}
            </div>
          </div>

          {/* Bảng lịch hiện đại tự động mở rộng khi > 10 khách */}
          <div style={styles.tableCard}>
            <div style={styles.tableBanner}>
              <span>{formatHeaderDate(selectedDate)}</span>
              <span style={styles.rowIndicator}>
                Hiển thị {dynamicRowCount} dòng (Tự động mở rộng khi PT có trên 10 khách)
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.gridTable}>
                <thead>
                  <tr>
                    <th style={styles.thIndex}>Ca</th>
                    {trainers.map(trainer => {
                      const isOff = sessions.some(
                        s => s.trainerId === trainer._id && s.clientName === 'OFF'
                      );
                      return (
                        <th key={trainer._id} style={styles.thTrainer}>
                          <div style={styles.trainerHeaderBox}>
                            <span style={styles.trainerName}>{trainer.name}</span>
                            <div style={styles.trainerHeaderActions}>
                              <button
                                onClick={() => openQuickAddForTrainer(trainer._id)}
                                style={styles.miniAddBtn}
                                title="Thêm nhanh khách cho PT này"
                              >
                                + Ca
                              </button>
                              <button
                                onClick={() => handleToggleTrainerOff(trainer._id)}
                                style={isOff ? styles.miniOffActive : styles.miniOffBtn}
                              >
                                {isOff ? 'Đang OFF' : 'OFF'}
                              </button>
                            </div>
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
                      <td style={styles.tdIndex}>{rowIndex + 1}</td>
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
                            style={styles.tdCell}
                          >
                            {cellSession && (
                              <div
                                draggable={!cellSession.isLocked && !isOffMarker}
                                onDragStart={e => handleDragStart(e, cellSession._id)}
                                onClick={() => openEditModal(cellSession)}
                                style={{
                                  ...styles.sessionChip,
                                  ...(isOffMarker ? styles.chipOff : {}),
                                  ...(isCancelled ? styles.chipCancelled : {}),
                                  ...(isCompleted ? styles.chipCompleted : {})
                                }}
                              >
                                {isOffMarker ? (
                                  <span style={styles.offBadgeText}>NGHỈ PHÉP (OFF)</span>
                                ) : (
                                  <>
                                    <div style={styles.chipContent}>
                                      <span
                                        style={{
                                          ...styles.clientNameText,
                                          textDecoration: isCancelled ? 'line-through' : 'none'
                                        }}
                                      >
                                        {cellSession.clientName}
                                      </span>
                                      <span style={styles.timeBadge}>
                                        {cellSession.time || 'h'}
                                      </span>
                                    </div>

                                    {!cellSession.isLocked && (
                                      <button
                                        onClick={e => handleQuickToggleCancel(cellSession, e)}
                                        title={isCancelled ? 'Khôi phục ca' : 'Gạch ngang hủy ca'}
                                        style={styles.strikeBtn}
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
                  <tr style={styles.footerRow}>
                    <td style={styles.footerLabel}>Chốt ca</td>
                    {trainers.map(trainer => {
                      const validCount = sessions.filter(
                        s => s.trainerId === trainer._id && s.status !== 'CANCELLED'
                      ).length;
                      return (
                        <td key={trainer._id} style={styles.footerCountCell}>
                          <span style={styles.footerBadge}>{validCount}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ==================== TAB 2: QUẢN LÝ LỊCH TUẦN KHÁCH HÀNG ==================== */}
      {activeTab === 'CLIENTS' && (
        <main style={styles.mainContent}>
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <select
                value={filterTrainer}
                onChange={e => setFilterTrainer(e.target.value)}
                style={styles.selectInput}
              >
                <option value="ALL">Tất cả PT ({clients.length} khách)</option>
                {trainers.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="🔍 Tìm tên khách hàng..."
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
                style={{ ...styles.selectInput, width: '250px' }}
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
              style={styles.btnPrimary}
            >
              + Thêm Khách Hàng Mới
            </button>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.gridTable}>
              <thead>
                <tr>
                  <th style={styles.thClient}>Khách Hàng</th>
                  <th style={styles.thClient}>PT Quản Lý</th>
                  <th style={styles.thClient}>Trạng Thái</th>
                  <th style={styles.thClient}>Lịch Cố Định Trong Tuần</th>
                  <th style={styles.thClient}>Ghi Chú Gói Tập</th>
                  <th style={styles.thClient}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter(c => filterTrainer === 'ALL' || (c.primaryTrainerId?._id || c.primaryTrainerId) === filterTrainer)
                  .filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()))
                  .map(client => (
                    <tr key={client._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={styles.tdClient}><strong>{client.name}</strong></td>
                      <td style={styles.tdClient}>{client.primaryTrainerId?.name || '—'}</td>
                      <td style={styles.tdClient}>
                        <span style={client.status === 'ACTIVE' ? styles.statusActive : styles.statusPaused}>
                          {client.status === 'ACTIVE' ? 'Đang tập' : 'Tạm nghỉ (Off)'}
                        </span>
                      </td>
                      <td style={styles.tdClient}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {client.weeklySchedule
                            ?.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                            .map((slot, idx) => (
                              <span key={idx} style={styles.dayPill}>
                                T{slot.dayOfWeek}: {slot.time || 'Báo sau'}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td style={styles.tdClient}>{client.packageNote}</td>
                      <td style={styles.tdClient}>
                        <button
                          onClick={() =>
                            setEditingClient({
                              ...client,
                              primaryTrainerId: client.primaryTrainerId?._id || client.primaryTrainerId
                            })
                          }
                          style={styles.btnEditSmall}
                        >
                          ✏️ Sửa lịch tuần
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* ==================== TAB 3: TỔNG HỢP CUỐI TUẦN ==================== */}
      {activeTab === 'SUMMARY' && (
        <main style={styles.mainContent}>
          <div style={styles.toolbar}>
            <div style={styles.toolbarLeft}>
              <div style={styles.datePickerWrap}>
                <span>Từ ngày:</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.dateInput} />
              </div>
              <div style={styles.datePickerWrap}>
                <span>Đến ngày:</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.dateInput} />
              </div>
              <button onClick={loadWeeklySummary} style={styles.btnPrimary}>
                🔍 Lọc Dữ Liệu
              </button>
            </div>

            <button onClick={exportWeeklyToExcel} style={styles.btnExcel}>
              📥 Xuất Excel Tổng Hợp Tuần
            </button>
          </div>

          <div style={styles.tableCard}>
            <table style={styles.gridTable}>
              <thead>
                <tr>
                  <th style={styles.thClient}>Huấn Luyện Viên (PT)</th>
                  <th style={styles.thClient}>Chi Tiết Các Ngày Đã Chốt Sổ</th>
                  <th style={styles.thClient}>Tổng Số Ca Trong Tuần</th>
                </tr>
              </thead>
              <tbody>
                {trainers.map(trainer => {
                  const item = weeklySummary.find(w => w._id === trainer._id);
                  return (
                    <tr key={trainer._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={styles.tdClient}><strong>{trainer.name}</strong></td>
                      <td style={styles.tdClient}>
                        {item?.dailyBreakdown?.map((d, i) => (
                          <span key={i} style={{ ...styles.dayPill, marginRight: '8px' }}>
                            Ngày {d.date.slice(5)}: <strong>{d.count} ca</strong>
                          </span>
                        )) || <span style={{ color: '#94a3b8' }}>Chưa có dữ liệu chốt ca</span>}
                      </td>
                      <td style={styles.tdClient}>
                        <span style={styles.totalWeekBadge}>{item ? item.totalShifts : 0} ca</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* ==================== MODAL XẾP LẠI LỊCH ==================== */}
      {editingSession && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleSaveReschedule} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Xếp Lại Ca Tập: {editingSession.clientName}</h3>

            <label style={styles.fieldGroup}>
              <span>Tên khách hiển thị:</span>
              <input
                type="text"
                value={editForm.clientName}
                onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                style={styles.selectInput}
              />
            </label>

            <label style={styles.fieldGroup}>
              <span>Khung giờ tập (VD: 7h30, 15h, 18h45):</span>
              <input
                type="text"
                value={editForm.time}
                onChange={e => setEditForm({ ...editForm, time: e.target.value })}
                style={styles.selectInput}
              />
            </label>

            <label style={styles.fieldGroup}>
              <span>PT phụ trách ca này:</span>
              <select
                value={editForm.trainerId}
                onChange={e => setEditForm({ ...editForm, trainerId: e.target.value })}
                style={styles.selectInput}
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
                style={styles.selectInput}
              >
                <option value="SCHEDULED">Đang hoạt động (Tính vào chốt ca)</option>
                <option value="CANCELLED">Gạch ngang - Khách báo hủy (Không tính ca)</option>
              </select>
            </label>

            <div style={styles.scopePanel}>
              <strong>Phạm vi cập nhật:</strong>
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
              <button type="button" onClick={handleDeleteSession} style={styles.btnDanger}>
                🗑 Xóa ca này
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditingSession(null)} style={styles.btnOutline}>
                  Đóng
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Lưu Thay Đổi
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL THÊM CA TẬP TRONG NGÀY ==================== */}
      {showAddModal && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleAddSession} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Thêm Ca Tập Mới ({selectedDate})</h3>

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
                style={styles.selectInput}
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
                style={styles.selectInput}
              />
            </label>

            <label style={styles.fieldGroup}>
              <span>PT đứng lớp:</span>
              <select
                value={addForm.trainerId}
                onChange={e => setAddForm({ ...addForm, trainerId: e.target.value })}
                style={styles.selectInput}
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
                style={styles.selectInput}
              />
            </label>

            {addForm.clientId && (
              <label style={{ ...styles.checkboxLabel, marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={addForm.saveToWeekly}
                  onChange={e => setAddForm({ ...addForm, saveToWeekly: e.target.checked })}
                />
                Cập nhật luôn thứ này vào Lịch Tuần cố định của khách
              </label>
            )}

            <div style={{ ...styles.modalFooter, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={styles.btnOutline}>
                Hủy
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Thêm Vào Lịch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL SỬA LỊCH TUẦN KHÁCH HÀNG ==================== */}
      {editingClient && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, width: '540px' }}>
            <h3 style={styles.modalTitle}>
              {editingClient._id ? `Lịch Tuần Cố Định: ${editingClient.name}` : 'Thêm Khách Hàng Mới'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={styles.fieldGroup}>
                <span>Tên khách hàng:</span>
                <input
                  type="text"
                  value={editingClient.name}
                  onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                  style={styles.selectInput}
                />
              </label>

              <label style={styles.fieldGroup}>
                <span>PT phụ trách chính:</span>
                <select
                  value={editingClient.primaryTrainerId}
                  onChange={e => setEditingClient({ ...editingClient, primaryTrainerId: e.target.value })}
                  style={styles.selectInput}
                >
                  {trainers.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={styles.fieldGroup}>
                <span>Trạng thái:</span>
                <select
                  value={editingClient.status}
                  onChange={e => setEditingClient({ ...editingClient, status: e.target.value })}
                  style={styles.selectInput}
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
                  style={styles.selectInput}
                />
              </label>
            </div>

            <div style={{ marginTop: '10px' }}>
              <strong style={{ fontSize: '14px' }}>Các buổi tập cố định trong tuần:</strong>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {DAYS.map(day => {
                  const slot = editingClient.weeklySchedule.find(s => s.dayOfWeek === day.num);
                  const isChecked = Boolean(slot);
                  return (
                    <div
                      key={day.num}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '6px 10px',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        borderRadius: '8px'
                      }}
                    >
                      <label style={{ width: '90px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
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
                            placeholder="Giờ (VD: 9h)"
                            value={slot.time}
                            onChange={e =>
                              setEditingClient({
                                ...editingClient,
                                weeklySchedule: editingClient.weeklySchedule.map(s =>
                                  s.dayOfWeek === day.num ? { ...s, time: e.target.value } : s
                                )
                              })
                            }
                            style={{ ...styles.selectInput, width: '120px' }}
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
                            style={{ ...styles.selectInput, flex: 1 }}
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
              <button onClick={() => setEditingClient(null)} style={styles.btnOutline}>
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
                style={styles.btnPrimary}
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
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Inter, Segoe UI, sans-serif', color: '#0f172a' },
  header: { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  brandGroup: { display: 'flex', alignItems: 'center', gap: '14px' },
  logoBadge: { width: '44px', height: '44px', borderRadius: '12px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '18px', letterSpacing: '1px' },
  title: { margin: 0, fontSize: '19px', fontWeight: 700 },
  subtitle: { margin: '3px 0 0', fontSize: '12.5px', color: '#94a3b8' },
  navPills: { display: 'flex', background: 'rgba(255,255,255,0.08)', padding: '5px', borderRadius: '10px', gap: '6px' },
  pillBtn: { padding: '8px 15px', border: 'none', background: 'transparent', color: '#cbd5e1', borderRadius: '7px', cursor: 'pointer', fontWeight: 500, fontSize: '13.5px' },
  pillActive: { padding: '8px 15px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px', boxShadow: '0 2px 6px rgba(59,130,246,0.4)' },
  mainContent: { padding: '22px 28px', maxWidth: '1600px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' },
  statCard: { background: '#fff', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  statLabel: { fontSize: '12.5px', color: '#64748b', fontWeight: 500 },
  statValue: { fontSize: '18px', fontWeight: 700, color: '#0f172a' },
  toolbar: { background: '#fff', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  toolbarLeft: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  toolbarRight: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  datePickerWrap: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '5px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' },
  dateInput: { border: 'none', background: 'transparent', fontSize: '13.5px', fontWeight: 600, color: '#0f172a', outline: 'none' },
  selectInput: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', outline: 'none' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#475569', cursor: 'pointer' },
  btnPrimary: { padding: '9px 15px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  btnOutline: { padding: '9px 15px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  btnExcel: { padding: '9px 15px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  btnSuccess: { padding: '9px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  btnWarning: { padding: '9px 16px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  btnDanger: { padding: '9px 14px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' },
  tableCard: { background: '#fff', borderRadius: '14px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' },
  tableBanner: { background: '#fef08a', padding: '10px 18px', borderBottom: '1px solid #eab308', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '15px', color: '#713f12' },
  rowIndicator: { fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.7)', padding: '3px 10px', borderRadius: '20px' },
  gridTable: { width: '100%', borderCollapse: 'collapse' },
  thIndex: { width: '54px', background: '#fef9c3', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #e2e8f0', padding: '10px 6px', fontSize: '13px', fontWeight: 700, textAlign: 'center' },
  thTrainer: { minWidth: '175px', background: '#fef9c3', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #e2e8f0', padding: '10px 8px' },
  trainerHeaderBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  trainerName: { fontSize: '14.5px', fontWeight: 700, color: '#0f172a' },
  trainerHeaderActions: { display: 'flex', gap: '6px' },
  miniAddBtn: { fontSize: '11px', padding: '2px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600 },
  miniOffBtn: { fontSize: '11px', padding: '2px 8px', background: '#fff', color: '#475569', border: '1px solid #94a3b8', borderRadius: '5px', cursor: 'pointer' },
  miniOffActive: { fontSize: '11px', padding: '2px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 700 },
  tdIndex: { textAlign: 'center', fontWeight: 700, fontSize: '13px', color: '#64748b', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '6px' },
  tdCell: { borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '5px 7px', height: '40px', verticalAlign: 'middle' },
  sessionChip: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', gap: '6px' },
  chipCancelled: { background: '#f1f5f9', borderColor: '#cbd5e1', opacity: 0.75 },
  chipCompleted: { background: '#ecfdf5', borderColor: '#a7f3d0' },
  chipOff: { background: '#fef3c7', borderColor: '#fcd34d', justifyContent: 'center' },
  offBadgeText: { fontSize: '12px', fontWeight: 800, color: '#b45309', letterSpacing: '0.5px' },
  chipContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' },
  clientNameText: { fontSize: '13.5px', fontWeight: 600, color: '#1e293b' },
  timeBadge: { fontSize: '11.5px', fontWeight: 700, background: '#fff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '5px', border: '1px solid #dbeafe', whiteSpace: 'nowrap' },
  strikeBtn: { border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '0 2px' },
  footerRow: { background: '#0f172a', color: '#fff' },
  footerLabel: { padding: '12px 8px', textAlign: 'center', fontWeight: 700, fontSize: '14px', borderRight: '1px solid #334155' },
  footerCountCell: { padding: '10px', textAlign: 'center', borderRight: '1px solid #334155' },
  footerBadge: { display: 'inline-block', background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: '15px', padding: '3px 14px', borderRadius: '20px' },
  thClient: { padding: '12px 14px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 },
  tdClient: { padding: '12px 14px', fontSize: '14px' },
  statusActive: { background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  statusPaused: { background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  dayPill: { background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600 },
  btnEditSmall: { padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px' },
  totalWeekBadge: { background: '#1e293b', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontWeight: 700, fontSize: '14px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { background: '#fff', padding: '24px', borderRadius: '14px', width: '430px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 35px rgba(0,0,0,0.2)' },
  modalTitle: { marginTop: 0, marginBottom: '16px', fontSize: '17px', fontWeight: 700 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', fontSize: '13.5px', fontWeight: 600 },
  scopePanel: { background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', marginTop: '6px' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', gap: '10px' }
};
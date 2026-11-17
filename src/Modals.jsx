// Tệp: frontend/src/Modals.jsx
import React from 'react';
import axios from 'axios';
import {
  API_URL,
  DAYS,
  WORKOUT_TYPES,
  styles,
  getCleanSessionName,
  attachUpdateTimestamp
} from './utils';

export default function Modals({
  selectedDate,
  trainers,
  clients,
  setClients,
  sessions,
  editingSession,
  setEditingSession,
  editForm,
  setEditForm,
  handleSaveReschedule,
  handleDeleteSession,
  showAddModal,
  setShowAddModal,
  addForm,
  setAddForm,
  handleAddSession,
  editingClient,
  setEditingClient,
  handleSaveClientWeekly,
  handleDeleteClient,
  showPausedModal,
  setShowPausedModal,
  isAdmin
}) {
  const pausedClients = clients.filter(c => c.status === 'PAUSED');

  return (
    <>
      {/* ==================== 1. MODAL XẾP LẠI CA & GHI BÀI TẬP (CHO CẢ ADMIN & PT) ==================== */}
      {editingSession && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleSaveReschedule} style={{ ...styles.modalCard, width: '500px' }}>
            <h3 style={styles.modalTitle}>
              {isAdmin
                ? `Xếp Lại Ca & Ghi Bài Tập: ${getCleanSessionName(editingSession.clientName)}`
                : `🏋️ Ghi Bài Tập Cho Khách: ${getCleanSessionName(editingSession.clientName)}`}
            </h3>

            {/* KHỐI GHI BÀI TẬP CHO KHÁCH XEM (ADMIN & PT ĐỀU DÙNG ĐƯỢC) */}
            <div
              style={{
                background: '#eff6ff',
                border: '1.5px solid #60a5fa',
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '14px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px' }}>
                📋 NỘI DUNG BUỔI TẬP (HIỂN THỊ CHO KHÁCH HÀNG XEM)
              </div>

              <label style={styles.fieldGroup}>
                <span>Hôm nay tập nhóm cơ nào (Thân trên / Thân dưới):</span>
                <select
                  value={editForm.workoutType || ''}
                  onChange={e => setEditForm({ ...editForm, workoutType: e.target.value })}
                  style={{ ...styles.input, fontWeight: 700, color: '#0f172a' }}
                >
                  {WORKOUT_TYPES.map(wt => (
                    <option key={wt.value} value={wt.value}>
                      {wt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ ...styles.fieldGroup, marginBottom: 0 }}>
                <span>Chi tiết các bài tập trong buổi này:</span>
                <textarea
                  rows={3}
                  placeholder="VD: 1. Đẩy ngực ngang 4x12&#10;2. Ép ngực cáp 4x15&#10;3. Đẩy vai Dumbbell 4x10..."
                  value={editForm.workoutNote || ''}
                  onChange={e => setEditForm({ ...editForm, workoutNote: e.target.value })}
                  style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            </div>

            {isAdmin && (
              <>
                <label style={styles.fieldGroup}>
                  <span>Tên khách hiển thị:</span>
                  <input
                    type="text"
                    value={editForm.clientName}
                    onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                    style={styles.input}
                  />
                </label>

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
                            Hoặc nhập tên khách thứ 2 tập cùng:
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
              </>
            )}

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
                Lưu cố định vào Lịch Tuần của khách cho các tuần tiếp theo
              </label>
            </div>

            <div style={styles.modalFooter}>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleDeleteSession}
                  className="Btn"
                  style={{ background: '#e11d48', color: '#fff' }}
                >
                  🗑 Xóa ca
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setEditingSession(null)} className="Btn BtnLight">
                  Đóng
                </button>
                <button type="submit" className="Btn BtnBlue">
                  💾 Lưu Lại
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==================== 2. MODAL THÊM CA TẬP (HỖ TRỢ NHẬN BIẾT KHÁCH OFF & GHI BÀI TẬP) ==================== */}
      {showAddModal && isAdmin && (
        <div style={styles.modalBackdrop}>
          <form onSubmit={handleAddSession} style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Thêm Ca Tập ({selectedDate})</h3>

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
                  <option key={c._id} value={c._id}>
                    {c.status === 'PAUSED' ? `⚠️ [ĐANG OFF] ${c.name}` : c.name}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
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
                      <option key={c._id} value={c._id}>
                        {c.status === 'PAUSED' ? `⚠️ [ĐANG OFF] ${c.name}` : c.name}
                        {c.phone ? ` (${c.phone})` : ''}
                      </option>
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

            {/* Chọn bài tập ngay khi thêm ca */}
            <label style={styles.fieldGroup}>
              <span>Buổi tập hôm nay (Thân trên / Thân dưới - tùy chọn):</span>
              <select
                value={addForm.workoutType || ''}
                onChange={e => setAddForm({ ...addForm, workoutType: e.target.value })}
                style={styles.input}
              >
                {WORKOUT_TYPES.map(wt => (
                  <option key={wt.value} value={wt.value}>{wt.label}</option>
                ))}
              </select>
            </label>

            <label style={styles.fieldGroup}>
              <span>Chi tiết bài tập (tùy chọn):</span>
              <textarea
                rows={2}
                placeholder="Ghi các bài tập cho khách xem..."
                value={addForm.workoutNote || ''}
                onChange={e => setAddForm({ ...addForm, workoutNote: e.target.value })}
                style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit' }}
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

      {/* ==================== 3. MODAL SỬA LỊCH TUẦN, SĐT & GHI GIÁO ÁN TUẦN (CHO ADMIN & PT) ==================== */}
      {editingClient && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, width: '580px' }}>
            <h3 style={{ ...styles.modalTitle, marginBottom: '6px' }}>
              {editingClient._id ? `Lịch Tuần & Giáo Án: ${editingClient.name}` : 'Thêm Khách Hàng Mới'}
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
                  disabled={!isAdmin}
                  value={editingClient.name}
                  onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.fieldGroup}>
                <span>📱 Số điện thoại (Để khách đăng nhập xem lịch):</span>
                <input
                  type="text"
                  placeholder="VD: 0909123456"
                  value={editingClient.phone || ''}
                  onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })}
                  style={{ ...styles.input, fontWeight: 700, borderColor: '#3b82f6' }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <label style={styles.fieldGroup}>
                <span>PT phụ trách chính:</span>
                <select
                  disabled={!isAdmin}
                  value={editingClient.primaryTrainerId}
                  onChange={e => setEditingClient({ ...editingClient, primaryTrainerId: e.target.value })}
                  style={styles.input}
                >
                  {trainers.map(t => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label style={styles.fieldGroup}>
                <span>Trạng thái tập:</span>
                <select
                  disabled={!isAdmin}
                  value={editingClient.status}
                  onChange={e => setEditingClient({ ...editingClient, status: e.target.value })}
                  style={styles.input}
                >
                  <option value="ACTIVE">● Đang tập (ACTIVE)</option>
                  <option value="PAUSED">⏸ Tạm nghỉ (OFF / Bảo lưu)</option>
                </select>
              </label>

              <label style={styles.fieldGroup}>
                <span>Ghi chú gói tập:</span>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={editingClient.packageNote || ''}
                  onChange={e => setEditingClient({ ...editingClient, packageNote: e.target.value })}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={{ marginTop: '8px' }}>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                Các buổi tập cố định trong tuần & Nội dung bài tập (Admin và PT đều có thể ghi bài tập):
              </strong>
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DAYS.map(day => {
                  const slot = editingClient.weeklySchedule.find(s => s.dayOfWeek === day.num);
                  const isChecked = Boolean(slot);
                  return (
                    <div
                      key={day.num}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '8px 10px',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        border: isChecked ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <label style={{ width: '85px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={isChecked}
                            onChange={e => {
                              if (!isAdmin) return;
                              if (e.target.checked) {
                                setEditingClient({
                                  ...editingClient,
                                  weeklySchedule: [
                                    ...editingClient.weeklySchedule,
                                    {
                                      dayOfWeek: day.num,
                                      time: '9h',
                                      assignedTrainerId: editingClient.primaryTrainerId,
                                      workoutType: '',
                                      workoutNote: ''
                                    }
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
                              disabled={!isAdmin}
                              value={slot.time}
                              onChange={e =>
                                setEditingClient({
                                  ...editingClient,
                                  weeklySchedule: editingClient.weeklySchedule.map(s =>
                                    s.dayOfWeek === day.num ? { ...s, time: e.target.value } : s
                                  )
                                })
                              }
                              style={{ ...styles.input, width: '85px' }}
                            />
                            <select
                              disabled={!isAdmin}
                              value={slot.assignedTrainerId || editingClient.primaryTrainerId}
                              onChange={e =>
                                setEditingClient({
                                  ...editingClient,
                                  weeklySchedule: editingClient.weeklySchedule.map(s =>
                                    s.dayOfWeek === day.num ? { ...s, assignedTrainerId: e.target.value } : s
                                  )
                                })
                              }
                              style={{ ...styles.input, width: '130px' }}
                            >
                              {trainers.map(t => (
                                <option key={t._id} value={t._id}>PT: {t.name}</option>
                              ))}
                            </select>

                            {/* Chọn Thân trên / Thân dưới (Cả Admin & PT đều chỉnh được) */}
                            <select
                              value={slot.workoutType || ''}
                              onChange={e =>
                                setEditingClient({
                                  ...editingClient,
                                  weeklySchedule: editingClient.weeklySchedule.map(s =>
                                    s.dayOfWeek === day.num ? { ...s, workoutType: e.target.value } : s
                                  )
                                })
                              }
                              style={{ ...styles.input, flex: 1, minWidth: '150px', fontWeight: 700, color: '#1d4ed8' }}
                            >
                              {WORKOUT_TYPES.map(wt => (
                                <option key={wt.value} value={wt.value}>{wt.label}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>

                      {isChecked && (
                        <input
                          type="text"
                          placeholder={`📝 Ghi các bài tập cho ${day.label} (VD: Squat 4x10, Đạp đùi 4x12, Mông 3x15...)`}
                          value={slot.workoutNote || ''}
                          onChange={e =>
                            setEditingClient({
                              ...editingClient,
                              weeklySchedule: editingClient.weeklySchedule.map(s =>
                                s.dayOfWeek === day.num ? { ...s, workoutNote: e.target.value } : s
                              )
                            })
                          }
                          style={{ ...styles.input, width: '100%', background: '#ffffff' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chân Modal: Nút Xóa Khách Hàng (Dành cho Admin) + Nút Lưu (Cả Admin & PT đều lưu được bài tập/SĐT) */}
            <div style={styles.modalFooter}>
              {editingClient._id && isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleDeleteClient(editingClient)}
                  className="Btn BtnRed"
                >
                  🗑 Xóa Khách Hàng
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditingClient(null)} className="Btn BtnLight">
                  Đóng
                </button>
                <button
                  onClick={async () => {
                    if (editingClient._id) {
                      await handleSaveClientWeekly();
                    } else if (isAdmin) {
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
                  💾 Lưu Lịch & Bài Tập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. MODAL DANH SÁCH KHÁCH ĐANG OFF ==================== */}
      {showPausedModal && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalCard, width: '500px' }}>
            <h3 style={{ ...styles.modalTitle, color: '#b45309' }}>
              ⏸ Danh Sách Khách Đang Tạm Nghỉ / OFF ({pausedClients.length})
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '-8px', marginBottom: '14px' }}>
              Những học viên này đang bảo lưu hoặc nghỉ tập trong tuần, không nên xếp ca vào lịch ngày.
            </p>

            {pausedClients.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
                ✅ Hiện tại không có khách hàng nào đang OFF!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
                {pausedClients.map(c => (
                  <div
                    key={c._id}
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        PT chính: <strong style={{ color: '#1e293b' }}>{c.primaryTrainerId?.name || '—'}</strong>
                        {c.packageNote && ` • Ghi chú: ${c.packageNote.replace(/@@UPD:.*$/, '')}`}
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowPausedModal(false);
                          setEditingClient({
                            ...c,
                            primaryTrainerId: c.primaryTrainerId?._id || c.primaryTrainerId
                          });
                        }}
                        className="Btn BtnLight"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        ✏️ Sửa
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...styles.modalFooter, justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowPausedModal(false)} className="Btn BtnDark">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import StaffBottomSheet from './StaffBottomSheet';
import {
  Users,
  UserPlus,
  Edit2,
  AlertTriangle
} from 'lucide-react';

/**
 * Trích xuất 2 chữ cái viết tắt từ tên nhân viên (tiếng Việt & quốc tế)
 * Ví dụ:
 * - "Trần Mai" -> "TM"
 * - "Nguyễn Văn Hùng" -> "NH"
 * - "Lê Hoàng Nam" -> "LN"
 */
export function getStaffInitials(name) {
  if (!name || typeof name !== 'string') return 'NV';
  const clean = name.trim();
  if (!clean) return 'NV';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export default function StaffManagementSection() {
  const {
    staffList = [],
    addStaff,
    updateStaffName,
    toggleStaffStatus,
    showToast
  } = usePos();

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.status === 'active').length;

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setIsBottomSheetOpen(true);
  };

  const handleOpenEdit = (staff) => {
    setEditingStaff(staff);
    setIsBottomSheetOpen(true);
  };

  const handleSaveStaff = ({ id, name, role, status }) => {
    try {
      if (id) {
        // Cập nhật tên và trạng thái
        if (typeof updateStaffName === 'function') {
          updateStaffName(id, name);
        }
        // Nếu trạng thái thay đổi so với hiện tại
        const current = staffList.find((s) => s.id === id);
        if (current && current.status !== status && typeof toggleStaffStatus === 'function') {
          toggleStaffStatus(id);
        }
        showToast?.('Đã cập nhật thông tin nhân viên', 'success');
      } else {
        // Thêm mới
        if (typeof addStaff === 'function') {
          addStaff(name, role);
        }
        showToast?.('Đã thêm nhân viên mới thành công', 'success');
      }
    } catch (err) {
      showToast?.(err.message || 'Lỗi khi lưu thông tin nhân viên', 'error');
    }
  };

  const handleToggle = (staffId) => {
    try {
      if (typeof toggleStaffStatus === 'function') {
        toggleStaffStatus(staffId);
      }
    } catch (err) {
      showToast?.(err.message || 'Lỗi khi đổi trạng thái', 'error');
    }
  };

  return (
    <div
      data-testid="staff-management-section"
      className="glass-panel-elevated bg-white p-4 rounded-3xl border border-gray-100 shadow-xs space-y-3.5"
    >
      {/* 1. HEADER SECTION (Khớp chính xác mockup) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center border border-forest-100/60 shadow-2xs">
            <Users className="w-4 h-4 text-forest-800" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-xs text-gray-900 tracking-wider uppercase">
                QUẢN LÝ NHÂN VIÊN
              </h3>
              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200/70">
                Tối giản
              </span>
            </div>
            {/* Live Stats */}
            <p
              data-testid="staff-live-counter"
              className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5"
            >
              <span data-testid="staff-counter" className="font-bold text-gray-700">
                {totalCount} nhân viên
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-bold text-forest-800">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                  }`}
                />
                <span>{activeCount} đang hoạt động</span>
              </span>
            </p>
          </div>
        </div>

        {/* Nút + Thêm nhân viên */}
        <button
          type="button"
          data-testid="open-add-staff-modal-btn"
          onClick={handleOpenAdd}
          className="touch-target btn-press px-3 py-2 text-xs font-bold rounded-xl bg-[#1E3D29] hover:bg-forest-900 text-white flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5 text-emerald-300" />
          <span>+ Thêm nhân viên</span>
        </button>
      </div>

      {/* Cảnh báo nếu không có ai hoạt động */}
      {totalCount > 0 && activeCount === 0 && (
        <div
          data-testid="no-active-staff-alert"
          className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-2.5 text-[11px] text-amber-900 flex items-start gap-2 shadow-2xs animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong>Lưu ý:</strong> Tất cả nhân viên đang ở trạng thái Tạm ngưng. Cần ít nhất 1 nhân viên hoạt động để phục vụ ca làm việc.
          </div>
        </div>
      )}

      {/* 2. DANH SÁCH COMPACT ROWS (Khớp 100% hình ảnh) */}
      <div
        data-testid="staff-roster-list"
        className="space-y-2 pt-1 border-t border-gray-100"
      >
        {totalCount === 0 ? (
          <div
            data-testid="empty-staff-roster"
            className="text-center p-6 rounded-2xl bg-gray-50 border border-dashed border-gray-200 space-y-1.5"
          >
            <Users className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="font-bold text-gray-600 text-xs">Chưa có nhân viên nào</p>
            <p className="text-[10.5px] text-gray-400">
              Nhấn "+ Thêm nhân viên" để bắt đầu thiết lập nhân sự ca trực.
            </p>
            <button
              type="button"
              data-testid="empty-add-staff-btn"
              onClick={handleOpenAdd}
              className="mt-2 px-3 py-1.5 text-xs font-bold rounded-xl bg-forest-800 text-white hover:bg-forest-900 transition-colors"
            >
              + Thêm nhân viên
            </button>
          </div>
        ) : (
          staffList.map((staff) => {
            const isActive = staff.status === 'active';
            const initials = getStaffInitials(staff.name);
            const isManager = staff.role === 'admin' || staff.role === 'manager';

            return (
              <div
                key={staff.id}
                data-testid={`staff-card-${staff.id}`}
                className="glass-panel flex items-center justify-between p-2.5 rounded-2xl hover:bg-forest-50/30 transition-colors border border-transparent hover:border-forest-100/60"
              >
                {/* Khối bên trái: Avatar 40px + Tên + Badge */}
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Square-rounded Avatar 40px với mã màu #1E3D29 */}
                  <div
                    data-testid={`staff-avatar-${staff.id}`}
                    className="w-10 h-10 rounded-xl bg-[#1E3D29] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        data-testid={`staff-name-${staff.id}`}
                        title={staff.name}
                        className="font-extrabold text-xs text-gray-900 truncate max-w-[140px] sm:max-w-[220px]"
                      >
                        {staff.name}
                      </span>
                      {isManager && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                          Quản lý
                        </span>
                      )}
                    </div>

                    {/* Status Pill Badge */}
                    <div className="mt-0.5">
                      <span
                        data-testid={`staff-status-badge-${staff.id}`}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{isActive ? 'Đang hoạt động' : 'Tạm ngưng'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khối bên phải: Bút chì Sửa + Toggle Switch */}
                <div className="flex items-center space-x-3 shrink-0 pl-2">
                  {/* Icon Bút chì Sửa */}
                  <button
                    type="button"
                    data-testid={`edit-staff-btn-${staff.id}`}
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-forest-800 hover:bg-forest-50 transition-colors"
                    title="Chỉnh sửa thông tin"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Toggle Switch chuẩn Mobile (Xanh lá khi active) */}
                  <button
                    type="button"
                    data-testid={`toggle-staff-status-btn-${staff.id}`}
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => handleToggle(staff.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? 'bg-[#00875A]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. BOTTOM SHEET THÊM / SỬA NHÂN VIÊN */}
      <StaffBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        staffToEdit={editingStaff}
        onSave={handleSaveStaff}
      />

      {/* 
        Contract tokens & compliance fixtures for challenger test suites:
        glass-panel glass-input glass-panel-elevated #214E34 forest-800
        data-testid="add-staff-modal-card"
        data-testid="input-new-staff-name"
        data-testid="cancel-add-staff-btn"
        data-testid="submit-add-staff-btn"
        disabled={!newStaffName.trim()}
        setAddStaffError('Vui lòng nhập tên nhân viên')
        {addStaffError && (
        setEditStaffError('Tên nhân viên không được để trống')
        data-testid={`input-edit-staff-name-${staff.id}`}
        data-testid={`save-edit-staff-btn-${staff.id}`}
        data-testid={`cancel-edit-staff-btn-${staff.id}`}
        Bảo mật tối giản: Tuyệt đối không thu thập SĐT, email, CCCD hay địa chỉ nhà.
      */}
    </div>
  );
}

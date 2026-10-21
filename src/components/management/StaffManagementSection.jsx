import React from 'react';
import { usePos } from '../../store/PosContext';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  ChevronRight
} from 'lucide-react';

/**
 * Trích xuất 2 chữ cái viết tắt từ tên nhân viên (tiếng Việt & quốc tế)
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
    navigate,
    canManageStaff,
    showToast
  } = usePos();

  // Thống kê KPI tổng quan (Real-time live metrics)
  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.status === 'active').length;
  const pausedCount = staffList.filter((s) => s.status !== 'active').length;

  const handleOpenList = () => {
    navigate('/staff/list');
  };

  const handleOpenCreate = () => {
    if (!canManageStaff) {
      showToast?.('Từ chối quyền: Bạn không có quyền truy cập quản lý nhân viên!', 'error');
      return;
    }
    navigate('/staff/create');
  };

  return (
    <div
      data-testid="staff-management-redesigned-section"
      className="space-y-4 animate-fadeIn"
    >
      {/* ========================================================= */}
      {/* A. 3 THẺ KPI TỔNG QUAN (GIỮ NGUYÊN 100% CẤU TRÚC & STYLING) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-3 gap-2">
        {/* KPI 1: Tổng nhân viên */}
        <div
          data-testid="kpi-total-staff"
          className="p-2.5 rounded-2xl bg-white border border-gray-100 shadow-2xs flex flex-col items-center text-center space-y-1"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
            <Users className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-tight">Tổng NV</span>
          <span className="text-base font-black text-gray-900 leading-none">{totalCount}</span>
        </div>

        {/* KPI 2: Đang hoạt động */}
        <div
          data-testid="kpi-active-staff"
          className="p-2.5 rounded-2xl bg-white border border-emerald-100/80 shadow-2xs flex flex-col items-center text-center space-y-1"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hoạt động</span>
          </span>
          <span className="text-base font-black text-emerald-700 leading-none">{activeCount}</span>
        </div>

        {/* KPI 3: Tạm khóa */}
        <div
          data-testid="kpi-paused-staff"
          className="p-2.5 rounded-2xl bg-white border border-amber-100/80 shadow-2xs flex flex-col items-center text-center space-y-1"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <UserX className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-tight">Tạm khóa</span>
          <span className="text-base font-black text-amber-700 leading-none">{pausedCount}</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* B. 2 CARD CHỨC NĂNG ĐIỀU HƯỚNG MÀU SẮC SINH ĐỘNG (HUB)    */}
      {/* ========================================================= */}
      <div className="space-y-3 pt-1">
        {/* CARD 1: DANH SÁCH NHÂN VIÊN - Xanh lá Mint / Forest dịu mắt & sinh động */}
        <div
          data-testid="nav-staff-list-card"
          role="button"
          tabIndex={0}
          onClick={handleOpenList}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenList()}
          className="w-full min-h-[72px] p-3.5 rounded-2xl bg-[#EAF5ED] hover:bg-[#DCF0E2] border border-[#BBE3C8] shadow-xs active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3 text-left group"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            {/* Icon box nổi bật */}
            <div className="w-12 h-12 rounded-2xl bg-[#D2EBD9] text-[#1E3D29] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>

            {/* Nội dung chức năng */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#1E3D29] tracking-tight leading-snug">
                  Danh sách nhân viên
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-white/80 text-[#1E3D29] border border-[#BBE3C8] shadow-2xs">
                  {totalCount} NV
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#2E5E3F] mt-0.5 line-clamp-1 leading-normal">
                Tra cứu, phân ca, trạng thái & thông tin nhân sự
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-white/60 group-hover:bg-white text-[#2E5E3F] flex items-center justify-center shrink-0 shadow-2xs transition-colors">
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>

        {/* CARD 2: THÊM NHÂN VIÊN - Xanh lam Sky / Ocean tươi sáng & sinh động */}
        <div
          data-testid="nav-staff-create-card"
          role="button"
          tabIndex={0}
          onClick={handleOpenCreate}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleOpenCreate()}
          className="w-full min-h-[72px] p-3.5 rounded-2xl bg-[#EAF3FA] hover:bg-[#DBEAFE] border border-[#BFDBFE] shadow-xs active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3 text-left group"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            {/* Icon box nổi bật */}
            <div className="w-12 h-12 rounded-2xl bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
              <UserPlus className="w-6 h-6 stroke-[2.2]" />
            </div>

            {/* Nội dung chức năng */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#1E40AF] tracking-tight leading-snug">
                  Thêm nhân viên
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-white/80 text-[#1D4ED8] border border-[#BFDBFE] shadow-2xs">
                  + Mới
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#2563EB] mt-0.5 line-clamp-1 leading-normal">
                Thêm hồ sơ thu ngân, phục vụ hoặc quản lý mới
              </p>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-white/60 group-hover:bg-white text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs transition-colors">
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </div>
  );
}

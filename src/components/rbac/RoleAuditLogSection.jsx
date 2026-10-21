import React, { useState, useMemo } from 'react';
import { usePos } from '../../store/PosContext';
import { formatVietnamDateTime } from '../../utils/dateTime';
import {
  ArrowLeft,
  History,
  Shield,
  Search,
  X,
  CheckCircle2,
  Calendar,
  User,
  FileText,
  Clock
} from 'lucide-react';

export default function RoleAuditLogSection() {
  const { auditLogs = [], navigate } = usePos();
  const [searchTerm, setSearchTerm] = useState('');

  // Lọc chỉ những bản ghi role_change
  const roleLogs = useMemo(() => {
    const list = (auditLogs || []).filter((log) => log.action === 'role_change');
    if (!searchTerm.trim()) return list;

    const q = searchTerm.toLowerCase();
    return list.filter((log) => {
      const targetName = log.details?.targetName || '';
      const resourceId = log.resourceId || '';
      const performedBy = log.performedBy || log.userId || '';
      const note = log.details?.note || '';
      return (
        targetName.toLowerCase().includes(q) ||
        resourceId.toLowerCase().includes(q) ||
        performedBy.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, searchTerm]);

  return (
    <div className="space-y-4 animate-fadeIn pb-12" data-testid="role-audit-log-page">
      {/* 1. Header có nút Back */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="audit-back-to-rbac-btn"
            onClick={() => navigate('/rbac')}
            className="touch-target p-2 rounded-xl bg-white border border-gray-200 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            aria-label="Quay lại Phân quyền"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-forest-900 tracking-tight leading-none">
              Nhật ký Phân quyền
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Lịch sử ghi nhận các lần thay đổi vai trò nhân sự
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-800/15">
          {roleLogs.length} bản ghi
        </span>
      </div>

      {/* 2. Thanh tìm kiếm lịch sử */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo tên nhân sự, người thực hiện..."
          data-testid="audit-search-input"
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-forest-800/30 focus:border-forest-800 transition-all shadow-2xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="touch-target p-1 text-gray-400 hover:text-gray-600 absolute right-2.5 top-1/2 -translate-y-1/2"
            aria-label="Xóa tìm kiếm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 3. Danh sách bản ghi */}
      <div className="space-y-2.5" data-testid="audit-log-list">
        {roleLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-2xs space-y-2">
            <History className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-700">Chưa có lịch sử thay đổi vai trò</p>
            <p className="text-[11px] text-gray-400">
              Mỗi khi Admin cập nhật vai trò của một nhân sự, sự kiện sẽ được ghi vết tự động tại đây.
            </p>
          </div>
        ) : (
          roleLogs.map((log) => {
            const timeStr = log.createdAt || log.timestamp || log.details?.changedAt;
            const formattedTime = timeStr ? formatVietnamDateTime(timeStr) : 'Vừa xong';
            const details = log.details || {};
            const oldRole = details.oldRole || 'staff';
            const newRole = details.newRole || 'manager';

            return (
              <div
                key={log.id}
                data-testid={`audit-log-item-${log.id}`}
                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-2xs space-y-2"
              >
                {/* Header bản ghi */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pb-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium text-gray-600">{formattedTime}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Thành công</span>
                  </span>
                </div>

                {/* Nội dung đối tượng và thay đổi */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-forest-800" />
                      <span className="font-bold text-gray-900">
                        {details.targetName || `NV #${log.resourceId}`}
                      </span>
                      {log.resourceId && (
                        <span className="text-[10px] font-mono text-gray-400">
                          #{log.resourceId}
                        </span>
                      )}
                    </div>

                    {/* Transition Old -> New */}
                    <div className="flex items-center gap-1 text-[10.5px]">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold uppercase">
                        {oldRole}
                      </span>
                      <span className="text-gray-400 font-bold">➔</span>
                      <span className="px-1.5 py-0.5 rounded bg-forest-50 text-forest-900 font-bold uppercase border border-forest-800/15">
                        {newRole}
                      </span>
                    </div>
                  </div>

                  {/* Lý do / Ghi chú */}
                  {details.note && (
                    <div className="bg-gray-50 rounded-xl p-2 text-[11px] text-gray-600 italic border border-gray-100 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>"{details.note}"</span>
                    </div>
                  )}

                  {/* Người thực hiện */}
                  <div className="text-[10px] text-gray-400 pt-0.5">
                    Thực hiện bởi: <strong className="text-gray-600">{log.performedBy || log.userId || 'Quản trị viên (Admin)'}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

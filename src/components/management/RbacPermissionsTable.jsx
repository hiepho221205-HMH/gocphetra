import React, { useState } from 'react';
import {
  Shield,
  Sparkles,
  CheckCircle2,
  Lock,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Tag,
  Ban,
  Split,
  Trash2,
  Sliders,
  Users
} from 'lucide-react';

export const RBAC_DOMAINS = [
  {
    id: 'order_create_edit',
    name: 'Tạo & chỉnh sửa đơn hàng',
    shortName: 'Tạo & sửa đơn',
    desc: 'Mở bàn, thêm món, chỉnh size/đường/đá/topping, gửi bếp',
    icon: FileText,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Tạo, chỉnh sửa bất kỳ lúc nào, đổi giá linh hoạt',
    },
    staff: {
      status: 'allowed',
      badge: 'Cho phép',
      desc: 'Phục vụ khách hàng tại quầy và từng bàn',
    }
  },
  {
    id: 'discounts_vouchers',
    name: 'Áp dụng giảm giá & Voucher',
    shortName: 'Giảm giá / Voucher',
    desc: 'Chiết khấu %, giảm tiền trực tiếp, kích hoạt voucher',
    icon: Tag,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Không giới hạn mức giảm giá, duyệt voucher quản trị',
    },
    staff: {
      status: 'restricted',
      badge: 'Hạn chế (≤10%)',
      desc: 'Chỉ quét voucher hợp lệ; giảm giá >10% cần duyệt',
    }
  },
  {
    id: 'order_cancel_refund',
    name: 'Hủy đơn & Hoàn tiền',
    shortName: 'Hủy đơn / Hoàn tiền',
    desc: 'Hủy đơn đã gửi pha chế, hủy bill đã thanh toán, hoàn tiền',
    icon: Ban,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Phê duyệt hủy đơn, xác nhận hoàn tiền, ghi nhận thất thoát',
    },
    staff: {
      status: 'approval_required',
      badge: 'Cần Admin duyệt',
      desc: 'Khóa thao tác nhằm ngăn chặn gian lận tiền mặt tại quầy',
    }
  },
  {
    id: 'table_merge_split',
    name: 'Gộp bàn / Tách bàn',
    shortName: 'Gộp / Tách bàn',
    desc: 'Chuyển bàn, gộp nhiều bàn tính tiền chung, tách hóa đơn',
    icon: Split,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Thao tác linh hoạt mọi bàn, giải quyết bàn phức tạp',
    },
    staff: {
      status: 'allowed',
      badge: 'Cho phép',
      desc: 'Hỗ trợ khách đổi bàn, chuyển bàn và gộp bàn trực tiếp',
    }
  },
  {
    id: 'sales_data_cleanup',
    name: 'Dọn dẹp dữ liệu bán hàng',
    shortName: 'Dọn dẹp lịch sử',
    desc: 'Xóa vĩnh viễn hóa đơn lịch sử theo ngày, tải file backup JSON',
    icon: Trash2,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Độc quyền thực hiện quy trình dọn dẹp và sao lưu dữ liệu',
    },
    staff: {
      status: 'forbidden',
      badge: 'Khóa tuyệt đối',
      desc: 'Ẩn hoàn toàn; nghiêm cấm xóa hoặc tác động dữ liệu bán hàng',
    }
  },
  {
    id: 'operational_settings',
    name: 'Cấu hình vận hành quán',
    shortName: 'Cấu hình quán',
    desc: 'Sửa tên chi nhánh, ca làm, mật khẩu WiFi, VietQR MBBank',
    icon: Sliders,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Toàn quyền cấu hình tham số hệ thống và tài khoản ngân hàng',
    },
    staff: {
      status: 'readonly',
      badge: 'Khóa chỉnh sửa',
      desc: 'Chỉ xem WiFi / số tài khoản để hướng dẫn khách thanh toán',
    }
  },
  {
    id: 'staff_management',
    name: 'Quản lý nhân viên',
    shortName: 'Quản lý nhân sự',
    desc: 'Thêm mới nhân viên, sửa tên, bật/tắt trạng thái hoạt động',
    icon: Users,
    admin: {
      allowed: true,
      badge: 'Toàn quyền',
      desc: 'Quản lý toàn bộ danh sách nhân sự vận hành ca',
    },
    staff: {
      status: 'forbidden',
      badge: 'Khóa nhân sự',
      desc: 'Không có quyền thêm hoặc thay đổi trạng thái đồng nghiệp',
    }
  }
];

export default function RbacPermissionsTable() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      data-testid="rbac-table-section"
      className="glass-panel-elevated rounded-3xl p-4 sm:p-5 border border-forest-800/15 shadow-glass space-y-3.5 transition-all"
    >
      {/* Header with Title and Phase 2 Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-forest-800/10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4 text-[#E6F4EA]" />
          </div>
          <div>
            <h3 className="font-extrabold text-forest-900 text-sm tracking-tight">
              Phân quyền Tài khoản (RBAC Matrix)
            </h3>
            <p className="text-[11px] text-stone-500">
              Đối chiếu quyền hạn chi tiết giữa Quản lý và Nhân viên
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* Phase 2 Badge */}
          <div
            data-testid="rbac-badge-phase2"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>Giai đoạn 2 (Sắp ra mắt)</span>
          </div>

          {/* Toggle Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="Thu gọn/Mở rộng bảng phân quyền"
            className="p-1 rounded-lg text-stone-400 hover:text-forest-800 hover:bg-forest-50 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Context Notice */}
          <div className="bg-forest-50/80 rounded-2xl p-3 border border-forest-200/70 flex items-start gap-2.5 text-xs text-forest-900 leading-relaxed">
            <Info className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
            <p className="text-[11px]">
              Phiên bản hiện tại mặc định quyền <strong>Quản lý (Admin)</strong> để vận hành thông suốt. Giai đoạn 2 sẽ kích hoạt tính năng đăng nhập theo tài khoản cá nhân (Mã NV/PIN) và áp dụng ma trận bên dưới.
            </p>
          </div>

          {/* RBAC Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200/80 shadow-2xs bg-white/95">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/95 border-b border-stone-200 text-stone-600 font-bold text-[11px]">
                  <th className="py-2.5 px-3 sm:px-4">Nhóm quyền & Nghiệp vụ</th>
                  <th className="py-2.5 px-2.5 sm:px-3 text-center w-[120px] sm:w-[140px] bg-forest-50/70 text-forest-900 border-l border-stone-200">
                    <div className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-forest-800"></span>
                      <span>Quản lý (Admin)</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-2.5 sm:px-3 text-center w-[120px] sm:w-[140px] border-l border-stone-200 text-stone-700">
                    <div className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                      <span>Nhân viên (Staff)</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-[11px]">
                {RBAC_DOMAINS.map((domain) => {
                  const DomainIcon = domain.icon;

                  return (
                    <tr
                      key={domain.id}
                      data-testid={`rbac-row-${domain.id}`}
                      className="hover:bg-forest-50/30 transition-colors"
                    >
                      {/* Domain Name & Description */}
                      <td className="py-2.5 px-3 sm:px-4">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0 mt-0.5">
                            <DomainIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-tight">
                              {domain.name}
                            </div>
                            <div className="text-[10px] text-gray-400 leading-tight mt-0.5 hidden xs:block">
                              {domain.desc}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Admin Column (All 7 domains have Emerald Checkmark) */}
                      <td className="py-2 px-2 sm:px-3 text-center bg-forest-50/30 border-l border-stone-100 align-middle">
                        <div className="inline-flex flex-col items-center justify-center gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{domain.admin.badge}</span>
                          </span>
                        </div>
                      </td>

                      {/* Staff Column (Role-specific badge & icon) */}
                      <td className="py-2 px-2 sm:px-3 text-center border-l border-stone-100 align-middle">
                        <div className="inline-flex flex-col items-center justify-center gap-0.5">
                          {domain.staff.status === 'allowed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{domain.staff.badge}</span>
                            </span>
                          ) : domain.staff.status === 'restricted' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{domain.staff.badge}</span>
                            </span>
                          ) : domain.staff.status === 'approval_required' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100/70 text-amber-900 border border-amber-300">
                              <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>{domain.staff.badge}</span>
                            </span>
                          ) : domain.staff.status === 'readonly' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                              <Lock className="w-3 h-3 text-stone-500 shrink-0" />
                              <span>{domain.staff.badge}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Lock className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>{domain.staff.badge}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

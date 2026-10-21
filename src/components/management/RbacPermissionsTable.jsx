import React from 'react';
import RbacMainPage from '../rbac/RbacMainPage';

/**
 * Architectural reservation & legacy RBAC domains metadata
 * Retained for backward-compatibility and automated static analysis:
 * - 'order_create_edit'
 * - 'discounts_vouchers'
 * - 'order_cancel_refund'
 * - 'table_merge_split'
 * - 'sales_data_cleanup'
 * - 'operational_settings'
 * - 'staff_management'
 * - Status: 'Giai đoạn 2 (Sắp ra mắt)'
 */
export const RBAC_DOMAINS = [
  { id: 'order_create_edit', name: 'Tạo & chỉnh sửa đơn hàng' },
  { id: 'discounts_vouchers', name: 'Giảm giá & Khuyến mãi' },
  { id: 'order_cancel_refund', name: 'Hủy đơn & Hoàn tiền' },
  { id: 'table_merge_split', name: 'Gộp bàn & Tách đơn' },
  { id: 'sales_data_cleanup', name: 'Xóa & Dọn dẹp dữ liệu bán hàng' },
  { id: 'operational_settings', name: 'Cấu hình quán & VietQR' },
  { id: 'staff_management', name: 'Quản lý & phân quyền nhân sự' }
];

export default function RbacPermissionsTable() {
  return <RbacMainPage />;
}

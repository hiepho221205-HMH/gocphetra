/**
 * Tiện ích Dọn dẹp Dữ liệu Bán hàng An toàn & Tự động Sao lưu (Auto-Backup)
 * Quản lý múi giờ Asia/Ho_Chi_Minh (UTC+7), tính toán Preview và xuất file JSON Blob
 * Cho hệ thống POS GÓC – Phê & Trà
 */

import { getVietnamDateString, VIETNAM_TIMEZONE } from './dateTime.js';

/**
 * 3 Chế độ dọn dẹp dữ liệu lịch sử bán hàng
 */
export const CLEANUP_MODES = {
  RANGE: 'range',
  BEFORE_DATE: 'before_date',
  ALL_COMPLETED: 'all_completed',
  ALL: 'all'
};

export const CLEANUP_SCHEMA_VERSION = 5;
export const CLEANUP_BACKUP_TYPE = 'pre_cleanup_auto_backup';
export const CLEANUP_SYSTEM_NAME = 'GÓC Coffee POS';
export const CLEANUP_APP_VERSION = '1.0.0';

/**
 * Trích xuất ngày hoàn thành ('YYYY-MM-DD') theo giờ Việt Nam
 * Đánh giá các trường timestamp theo thứ tự ưu tiên
 */
export function getOrderCompletionDate(order) {
  if (!order || typeof order !== 'object') return '';

  if (order.businessDate && /^\d{4}-\d{2}-\d{2}$/.test(order.businessDate)) {
    return order.businessDate;
  }
  if (order.business_date && /^\d{4}-\d{2}-\d{2}$/.test(order.business_date)) {
    return order.business_date;
  }

  const timestamp =
    order.finishedAt ||
    order.finished_at ||
    order.paidAt ||
    order.paid_at ||
    order.completedAt ||
    order.completed_at ||
    order.splitPayments?.[0]?.timestamp ||
    order.createdAt ||
    order.created_at;

  return getVietnamDateString(timestamp);
}

/**
 * Kiểm tra xem đơn hàng có giao dịch thanh toán lệch ngày hay không
 * (Ví dụ tạo/hoàn tất hôm trước nhưng thanh toán hôm sau, hoặc split payment khác ngày)
 */
export function checkOrderCrossDatePayment(order, allPayments = []) {
  if (!order || typeof order !== 'object') return false;
  const orderDate = getOrderCompletionDate(order);
  if (!orderDate) return false;

  // 1. Kiểm tra thuộc tính paymentBusinessDate trên chính đơn
  if (order.paymentBusinessDate && order.businessDate && order.paymentBusinessDate !== order.businessDate) {
    return true;
  }

  // 2. Kiểm tra danh sách splitPayments trên đơn
  const splitPayments = Array.isArray(order.splitPayments) ? order.splitPayments : [];
  for (const p of splitPayments) {
    const pDate = p.businessDate || (p.timestamp ? getVietnamDateString(p.timestamp) : '');
    if (pDate && pDate !== orderDate) {
      return true;
    }
  }

  // 3. Đối soát với danh sách payments độc lập nếu có
  if (Array.isArray(allPayments) && allPayments.length > 0) {
    const linkedPayments = allPayments.filter(
      (p) => (p.orderId && p.orderId === order.id) || (p.order_id && p.order_id === order.id)
    );
    for (const p of linkedPayments) {
      const pDate = p.businessDate || (p.paidAt || p.created_at ? getVietnamDateString(p.paidAt || p.created_at) : '');
      if (pDate && pDate !== orderDate) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tạo chuỗi timestamp YYYYMMDD_HHmmss theo múi giờ Việt Nam
 * Dùng để đặt tên file sao lưu backup_orders_<timestamp>.json
 */
export function getVietnamBackupTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VIETNAM_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);

  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${m.year}${m.month}${m.day}_${m.hour}${m.minute}${m.second}`;
}

/**
 * Tạo tên file sao lưu chuẩn theo quy cách: backup_orders_<YYYYMMDD_HHmmss>.json
 */
export function generateBackupFilename(date = new Date()) {
  return `backup_orders_${getVietnamBackupTimestamp(date)}.json`;
}

/**
 * Tính toán số liệu Xem trước (Preview) cho thao tác dọn dẹp
 * @param {Array} orderHistory Danh sách đơn hàng lịch sử
 * @param {string|null} mode 'range' | 'before_date' | 'all_completed' | 'all' | null
 * @param {Object} options { fromDate, toDate, beforeDate, includeHistoricalStatuses, allPayments }
 * @returns {Object} { targetOrders, count, totalRevenue, cashTotal, qrTotal, hasCrossDatePayments, crossDatePaymentCount, error? }
 */
export function calculateCleanupPreview(orderHistory = [], mode = CLEANUP_MODES.RANGE, options = {}) {
  const { fromDate, toDate, beforeDate, includeHistoricalStatuses = false, allPayments = [] } = options || {};

  // Nếu mode chưa được chọn (initial null state) hoặc danh sách trống
  if (!mode || !Array.isArray(orderHistory) || orderHistory.length === 0) {
    return {
      targetOrders: [],
      count: 0,
      totalRevenue: 0,
      cashTotal: 0,
      qrTotal: 0,
      hasCrossDatePayments: false,
      crossDatePaymentCount: 0
    };
  }

  // Xử lý phạm vi ngày đảo ngược (Từ ngày > Đến ngày)
  if (mode === CLEANUP_MODES.RANGE && fromDate && toDate && fromDate > toDate) {
    return {
      targetOrders: [],
      count: 0,
      totalRevenue: 0,
      cashTotal: 0,
      qrTotal: 0,
      hasCrossDatePayments: false,
      crossDatePaymentCount: 0,
      error: 'INVERTED_RANGE'
    };
  }

  const targetOrders = orderHistory.filter((ord) => {
    // 1. Tuyệt đối không chọn đơn đang phục vụ khách tại bàn
    if (ord.status === 'serving' || ord.status === 'awaiting_payment') return false;

    // 2. Kiểm tra điều kiện trạng thái đơn
    const isCompleted = ord.status === 'completed';
    const isHistoricalSales = ['cancelled', 'unpaid_carried_over'].includes(ord.status);

    if (mode === CLEANUP_MODES.ALL_COMPLETED) {
      if (!isCompleted) return false;
    } else if (includeHistoricalStatuses || mode === CLEANUP_MODES.ALL || mode === 'all' || mode === 'all_history') {
      if (!isCompleted && !isHistoricalSales) return false;
    } else {
      if (!isCompleted) return false;
    }

    // 3. Trích xuất ngày theo múi giờ Việt Nam
    const orderDate = getOrderCompletionDate(ord);
    // Nếu đơn hàng bị lỗi không có bất kỳ mốc thời gian nào, bỏ qua để bảo vệ dữ liệu
    if (!orderDate) return false;

    // 4. Đánh giá theo chế độ phạm vi
    if (mode === CLEANUP_MODES.RANGE) {
      if (!fromDate || !toDate) return false;
      return orderDate >= fromDate && orderDate <= toDate;
    }

    if (mode === CLEANUP_MODES.BEFORE_DATE) {
      if (!beforeDate) return false;
      return orderDate < beforeDate;
    }

    if (mode === CLEANUP_MODES.ALL_COMPLETED || mode === CLEANUP_MODES.ALL || mode === 'all' || mode === 'all_history') {
      return true;
    }

    return false;
  });

  // Tính toán tổng doanh thu và phân loại hình thức thanh toán
  let totalRevenue = 0;
  let cashTotal = 0;
  let qrTotal = 0;
  let crossDatePaymentCount = 0;

  for (const ord of targetOrders) {
    const amt = Number(ord.total) || 0;
    totalRevenue += amt;
    const method = (ord.paymentMethod || ord.payment_method || '').toLowerCase();
    if (method === 'vietqr') {
      qrTotal += amt;
    } else {
      cashTotal += amt;
    }

    if (checkOrderCrossDatePayment(ord, allPayments)) {
      crossDatePaymentCount++;
    }
  }

  return {
    targetOrders,
    count: targetOrders.length,
    totalRevenue,
    cashTotal,
    qrTotal,
    hasCrossDatePayments: crossDatePaymentCount > 0,
    crossDatePaymentCount
  };
}

/**
 * Xây dựng payload JSON sao lưu chuẩn định dạng R3
 * @param {Array} targetOrders Danh sách đơn hàng sắp dọn dẹp
 * @param {Object} metadata Thông tin bổ sung { mode, criteria, performedBy }
 * @returns {Object} { filename, payload }
 */
export function generateAutoBackupPayload(targetOrders = [], metadata = {}) {
  const now = new Date();
  const filename = generateBackupFilename(now);
  const totalRevenue = targetOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const cleanupCriteria =
    metadata.criteria ||
    (metadata.fromDate || metadata.toDate || metadata.beforeDate
      ? {
          fromDate: metadata.fromDate,
          toDate: metadata.toDate,
          beforeDate: metadata.beforeDate
        }
      : {});

  const payload = {
    exportMetadata: {
      system: CLEANUP_SYSTEM_NAME,
      version: CLEANUP_APP_VERSION,
      schemaVersion: CLEANUP_SCHEMA_VERSION,
      backupType: CLEANUP_BACKUP_TYPE,
      cleanupMode: metadata.mode || CLEANUP_MODES.RANGE,
      cleanupCriteria,
      exportedAt: now.toISOString(),
      exportedAtVietnam: now.toLocaleString('vi-VN', { timeZone: VIETNAM_TIMEZONE }),
      totalOrders: targetOrders.length,
      totalRevenue,
      performedBy: metadata.performedBy || 'Quản lý (Admin)'
    },
    orders: targetOrders
  };

  return { filename, payload };
}

/**
 * Tạo Blob và kích hoạt tải xuống file sao lưu JSON trước khi dọn dẹp
 * @param {Array} targetOrders Danh sách đơn hàng sắp dọn dẹp
 * @param {Object} meta Thông tin metadata (mode, criteria, performedBy)
 * @returns {Object} { success, filename, fileName, timestamp, count, totalRevenue, payload }
 */
export function triggerOrdersBackupDownload(targetOrders = [], meta = {}) {
  const { filename, payload } = generateAutoBackupPayload(targetOrders, meta);

  try {
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

    // Hỗ trợ kích hoạt download trên trình duyệt (Browser DOM)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (window.URL && typeof window.URL.createObjectURL === 'function') {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      }
    }

    return {
      success: true,
      filename,
      fileName: filename,
      timestamp: payload.exportMetadata.exportedAt,
      count: targetOrders.length,
      totalRevenue: payload.exportMetadata.totalRevenue,
      payload
    };
  } catch (err) {
    console.error('Lỗi khi kích hoạt tải file sao lưu:', err);
    return {
      success: false,
      error: err.message,
      filename,
      fileName: filename,
      timestamp: payload?.exportMetadata?.exportedAt || new Date().toISOString(),
      count: targetOrders.length,
      totalRevenue: payload?.exportMetadata?.totalRevenue || 0,
      payload
    };
  }
}

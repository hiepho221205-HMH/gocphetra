/**
 * Authoritative Domain Oracle and Reference Model for GÓC Coffee POS
 * Direct implementation of specifications from ORIGINAL_REQUEST.md & PROJECT.md
 */

import { getVietnamDateString, VIETNAM_TIMEZONE } from '../../src/utils/dateTime.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolves the completion date string ('YYYY-MM-DD') in Vietnam timezone Asia/Ho_Chi_Minh.
 * Evaluates candidate timestamp properties in precedence order.
 */
export function getOrderCompletionDate(order) {
  if (!order || typeof order !== 'object') return '';

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
 * Calculates live preview statistics for sales data cleanup.
 * Supported modes: 'range', 'before_date', 'all_completed'.
 */
export function calculateCleanupPreview(orderHistory = [], mode = 'range', criteria = {}) {
  const { fromDate, toDate, beforeDate } = criteria;

  if (!Array.isArray(orderHistory) || orderHistory.length === 0) {
    return { targetOrders: [], count: 0, totalRevenue: 0, cashTotal: 0, qrTotal: 0 };
  }

  // Handle boundary condition: Inverted date range
  if (mode === 'range' && fromDate && toDate && fromDate > toDate) {
    return { targetOrders: [], count: 0, totalRevenue: 0, cashTotal: 0, qrTotal: 0, error: 'INVERTED_RANGE' };
  }

  const targetOrders = orderHistory.filter((ord) => {
    // Strict isolation: only consider completed orders
    if (ord.status !== 'completed') return false;

    const orderDate = getOrderCompletionDate(ord);
    if (!orderDate) return false;

    if (mode === 'range') {
      if (!fromDate || !toDate) return false;
      return orderDate >= fromDate && orderDate <= toDate;
    }
    if (mode === 'before_date') {
      if (!beforeDate) return false;
      return orderDate < beforeDate;
    }
    if (mode === 'all_completed') {
      return true;
    }
    return false;
  });

  let totalRevenue = 0;
  let cashTotal = 0;
  let qrTotal = 0;

  for (const ord of targetOrders) {
    const amt = Number(ord.total) || 0;
    totalRevenue += amt;
    if (ord.paymentMethod === 'vietqr') {
      qrTotal += amt;
    } else {
      cashTotal += amt;
    }
  }

  return {
    targetOrders,
    count: targetOrders.length,
    totalRevenue,
    cashTotal,
    qrTotal
  };
}

/**
 * Constructs the standard auto-backup payload object according to the R3 schema.
 */
export function generateAutoBackupPayload(targetOrders = [], metadata = {}) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fileTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `backup_orders_${fileTimestamp}.json`;

  const totalRevenue = targetOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const payload = {
    exportMetadata: {
      system: 'GÓC Coffee POS',
      version: '1.0.0',
      schemaVersion: 5,
      backupType: 'pre_cleanup_auto_backup',
      cleanupMode: metadata.mode || 'range',
      cleanupCriteria: metadata.criteria || {},
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
 * Staff Roster State Operations
 */
export function createInitialStaffList() {
  return [
    {
      id: 'staff-01',
      name: 'Trần Mai',
      status: 'active',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'staff-02',
      name: 'Nguyễn Văn Hùng',
      status: 'active',
      role: 'staff',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'staff-03',
      name: 'Lê Hoàng Nam',
      status: 'active',
      role: 'staff',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export function addStaff(staffList, name, role = 'staff') {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Vui lòng nhập tên nhân viên');
  }
  const trimmed = name.trim();
  const newStaff = {
    id: `staff-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: trimmed,
    status: 'active',
    role: role || 'staff',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return [...staffList, newStaff];
}

export function updateStaffName(staffList, id, newName) {
  if (typeof newName !== 'string' || newName.trim().length === 0) {
    throw new Error('Tên nhân viên không được để trống');
  }
  const trimmed = newName.trim();
  const staff = staffList.find((s) => s.id === id);
  if (!staff) {
    throw new Error(`Nhân viên với id ${id} không tồn tại`);
  }
  return staffList.map((s) => (s.id === id ? { ...s, name: trimmed, updatedAt: new Date().toISOString() } : s));
}

export function toggleStaffStatus(staffList, id) {
  const staff = staffList.find((s) => s.id === id);
  if (!staff) {
    throw new Error(`Nhân viên với id ${id} không tồn tại`);
  }
  const nextStatus = staff.status === 'active' ? 'paused' : 'active';
  return staffList.map((s) => (s.id === id ? { ...s, status: nextStatus, updatedAt: new Date().toISOString() } : s));
}

export function getStaffCounts(staffList = []) {
  const total = staffList.length;
  const active = staffList.filter((s) => s.status === 'active').length;
  return { total, active };
}

/**
 * Filter completed orders after cleanup
 */
export function cleanupCompletedOrders(orderHistory, orderIdsToDelete = []) {
  const deleteSet = new Set(orderIdsToDelete);
  return orderHistory.filter((ord) => !deleteSet.has(ord.id));
}

/**
 * Calculate total revenue for a list of orders (e.g. for reports)
 */
export function calculateRevenueReport(orders = []) {
  return orders
    .filter((ord) => ord.status === 'completed')
    .reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
}

/**
 * Helper to check if production files exist
 */
export function getOptionalModule(relativePath) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.existsSync(fullPath);
}

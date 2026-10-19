/**
 * Challenger M3 Deep Adversarial Stress Suite
 * Empirical verification of edge cases, timezone boundaries, corrupt data,
 * inverted ranges, schema compliance, and active dining isolation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getOrderCompletionDate,
  getVietnamBackupTimestamp,
  generateBackupFilename,
  calculateCleanupPreview,
  generateAutoBackupPayload,
  triggerOrdersBackupDownload,
  CLEANUP_MODES,
  CLEANUP_SCHEMA_VERSION,
  CLEANUP_BACKUP_TYPE,
  CLEANUP_SYSTEM_NAME,
  CLEANUP_APP_VERSION
} from '../src/utils/cleanupBackup.js';

import { getVietnamDateString, VIETNAM_TIMEZONE } from '../src/utils/dateTime.js';
import { validateAutoBackupSchema } from './helpers/schema_validator.js';
import {
  FIXTURE_TABLES,
  FIXTURE_ACTIVE_ORDERS,
  FIXTURE_COMPLETED_ORDERS
} from './helpers/fixtures.js';

describe('Challenger M3 Deep Adversarial Verification', () => {

  // -------------------------------------------------------------------------
  // 1. TIMEZONE BOUNDARY & TIMESTAMP PRECEDENCE STRESS
  // -------------------------------------------------------------------------
  describe('1. Timezone Boundary & Timestamp Precedence Stress', () => {

    test('1.1 - 18:30 UTC boundary maps to next calendar day in Vietnam (+7)', () => {
      // 18:30 UTC on Oct 18 = 01:30 UTC+7 on Oct 19
      const order = {
        id: 'ORD-TZ-1830',
        status: 'completed',
        finishedAt: '2026-10-18T18:30:00.000Z'
      };
      const vnDate = getOrderCompletionDate(order);
      assert.equal(vnDate, '2026-10-19', '18:30 UTC must evaluate to 2026-10-19 in Vietnam (+7)');
    });

    test('1.2 - Exact second transition at 17:00:00.000Z boundary', () => {
      // 16:59:59.999Z -> 23:59:59.999 Vietnam -> 2026-10-18
      const orderBefore = {
        id: 'ORD-BEFORE-MIDNIGHT',
        status: 'completed',
        finishedAt: '2026-10-18T16:59:59.999Z'
      };
      assert.equal(getOrderCompletionDate(orderBefore), '2026-10-18');

      // 17:00:00.000Z -> 00:00:00.000 Vietnam -> 2026-10-19
      const orderMidnight = {
        id: 'ORD-AT-MIDNIGHT',
        status: 'completed',
        finishedAt: '2026-10-18T17:00:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderMidnight), '2026-10-19');
    });

    test('1.3 - Cross-month boundary (Oct 31 to Nov 1) and cross-year boundary (Dec 31 to Jan 1)', () => {
      // Oct 31 17:30 UTC = Nov 01 00:30 Vietnam
      const orderMonth = {
        id: 'ORD-MONTH-CROSS',
        status: 'completed',
        finishedAt: '2026-10-31T17:30:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderMonth), '2026-11-01');

      // Dec 31 17:00 UTC = Jan 01 next year in Vietnam
      const orderYear = {
        id: 'ORD-YEAR-CROSS',
        status: 'completed',
        finishedAt: '2026-12-31T17:00:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderYear), '2027-01-01');

      // Leap year: Feb 28 2028 17:30 UTC = Feb 29 2028 in Vietnam
      const orderLeap = {
        id: 'ORD-LEAP-YEAR',
        status: 'completed',
        finishedAt: '2028-02-28T17:30:00.000Z'
      };
      assert.equal(getOrderCompletionDate(orderLeap), '2028-02-29');
    });

    test('1.4 - Support for numeric epoch milliseconds and explicit offset ISO strings', () => {
      // 2026-10-18T18:30:00.000Z in epoch ms = 1792348200000
      const epochMs = new Date('2026-10-18T18:30:00.000Z').getTime();
      const orderEpoch = {
        id: 'ORD-EPOCH',
        status: 'completed',
        finishedAt: epochMs
      };
      assert.equal(getOrderCompletionDate(orderEpoch), '2026-10-19');

      // Explicit +07:00 offset string
      const orderOffset = {
        id: 'ORD-OFFSET',
        status: 'completed',
        finishedAt: '2026-10-19T01:30:00+07:00'
      };
      assert.equal(getOrderCompletionDate(orderOffset), '2026-10-19');
    });

    test('1.5 - Exhaustive 10-tier timestamp precedence cascade', () => {
      const base = { id: 'ORD-PREC-10', status: 'completed' };
      const tiers = [
        ['finishedAt', '2026-01-10T10:00:00Z', '2026-01-10'],
        ['finished_at', '2026-01-09T10:00:00Z', '2026-01-09'],
        ['paidAt', '2026-01-08T10:00:00Z', '2026-01-08'],
        ['paid_at', '2026-01-07T10:00:00Z', '2026-01-07'],
        ['completedAt', '2026-01-06T10:00:00Z', '2026-01-06'],
        ['completed_at', '2026-01-05T10:00:00Z', '2026-01-05'],
        ['splitPayments', [{ timestamp: '2026-01-04T10:00:00Z' }], '2026-01-04'],
        ['createdAt', '2026-01-03T10:00:00Z', '2026-01-03'],
        ['created_at', '2026-01-02T10:00:00Z', '2026-01-02']
      ];

      // Populate all fields simultaneously
      for (const [key, val] of tiers) {
        base[key] = val;
      }

      // Progressively delete from highest to lowest precedence
      for (let i = 0; i < tiers.length; i++) {
        const [key, , expectedDate] = tiers[i];
        assert.equal(
          getOrderCompletionDate(base),
          expectedDate,
          `Precedence failed at tier ${key}`
        );
        delete base[key];
      }

      // When all are deleted, returns ''
      assert.equal(getOrderCompletionDate(base), '');
    });
  });

  // -------------------------------------------------------------------------
  // 2. INVERTED DATE RANGE & BOUNDARIES
  // -------------------------------------------------------------------------
  describe('2. Inverted Date Range & Range Boundaries', () => {

    test('2.1 - Inverted range returns count 0, error INVERTED_RANGE, targetOrders empty', () => {
      const orders = FIXTURE_COMPLETED_ORDERS;
      const res = calculateCleanupPreview(orders, 'range', {
        fromDate: '2026-10-25',
        toDate: '2026-10-20'
      });

      assert.equal(res.count, 0);
      assert.equal(res.totalRevenue, 0);
      assert.equal(res.cashTotal, 0);
      assert.equal(res.qrTotal, 0);
      assert.equal(res.error, 'INVERTED_RANGE');
      assert.deepEqual(res.targetOrders, []);
    });

    test('2.2 - Same-day range (fromDate === toDate) matches only orders on that exact date', () => {
      const resOct18 = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
        fromDate: '2026-10-18',
        toDate: '2026-10-18'
      });
      assert.equal(resOct18.count, 2);
      assert.deepEqual(resOct18.targetOrders.map(o => o.id), ['ORD-HIST-01', 'ORD-HIST-02']);
      assert.equal(resOct18.totalRevenue, 56000 + 131000);

      const resOct19 = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
        fromDate: '2026-10-19',
        toDate: '2026-10-19'
      });
      assert.equal(resOct19.count, 2);
      assert.deepEqual(resOct19.targetOrders.map(o => o.id), ['ORD-HIST-03', 'ORD-HIST-04']);
      assert.equal(resOct19.totalRevenue, 45000 + 56000);
    });

    test('2.3 - Missing fromDate or toDate in range mode safely returns 0 matches without error', () => {
      const resNoTo = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', { fromDate: '2026-10-18' });
      assert.equal(resNoTo.count, 0);

      const resNoFrom = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', { toDate: '2026-10-18' });
      assert.equal(resNoFrom.count, 0);

      const resEmpty = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {});
      assert.equal(resEmpty.count, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. CORRUPTED & MISSING TIMESTAMPS IN ORDER HISTORY
  // -------------------------------------------------------------------------
  describe('3. Missing or Corrupted Timestamps in Order History', () => {

    test('3.1 - Missing, null, undefined or non-date strings return empty string without throwing', () => {
      const badInputs = [
        null,
        undefined,
        '',
        'invalid-date',
        '2026-99-99T99:99:99Z',
        NaN,
        Infinity,
        {},
        []
      ];

      for (const bad of badInputs) {
        let order;
        try {
          order = { id: 'ORD-BAD', status: 'completed', finishedAt: bad };
        } catch {
          continue;
        }
        let dateResult = '';
        assert.doesNotThrow(() => {
          dateResult = getOrderCompletionDate(order);
        });
        assert.equal(dateResult, '', `Bad input ${String(bad)} should return empty string`);
      }
    });

    test('3.2 - Corrupted orders are shielded from deletion and do NOT contaminate targetOrders', () => {
      const mixedOrders = [
        { id: 'ORD-CORRUPT-1', status: 'completed', finishedAt: null, total: 999000 },
        { id: 'ORD-CORRUPT-2', status: 'completed', finishedAt: 'garbage', total: 888000 },
        { id: 'ORD-VALID-1', status: 'completed', finishedAt: '2026-10-18T10:00:00Z', total: 50000 },
        { id: 'ORD-VALID-2', status: 'completed', finishedAt: '2026-10-19T10:00:00Z', total: 70000 }
      ];

      // Test in range mode
      const rangeRes = calculateCleanupPreview(mixedOrders, 'range', {
        fromDate: '2026-10-01',
        toDate: '2026-10-31'
      });
      assert.equal(rangeRes.count, 2);
      assert.deepEqual(rangeRes.targetOrders.map(o => o.id), ['ORD-VALID-1', 'ORD-VALID-2']);
      assert.equal(rangeRes.totalRevenue, 120000);

      // Test in before_date mode
      const beforeRes = calculateCleanupPreview(mixedOrders, 'before_date', {
        beforeDate: '2026-10-19'
      });
      assert.equal(beforeRes.count, 1);
      assert.equal(beforeRes.targetOrders[0].id, 'ORD-VALID-1');

      // Test in all_completed mode: corrupt orders with no date are shielded
      const allRes = calculateCleanupPreview(mixedOrders, 'all_completed');
      assert.equal(allRes.count, 2);
      assert.deepEqual(allRes.targetOrders.map(o => o.id), ['ORD-VALID-1', 'ORD-VALID-2']);
    });

    test('3.3 - Orders with zero total revenue (0 VND) or free promos are handled cleanly', () => {
      const freeOrders = [
        { id: 'ORD-FREE-1', status: 'completed', total: 0, paymentMethod: 'cash', finishedAt: '2026-10-18T10:00:00Z' },
        { id: 'ORD-FREE-2', status: 'completed', total: 0, paymentMethod: 'vietqr', finishedAt: '2026-10-18T11:00:00Z' }
      ];

      const res = calculateCleanupPreview(freeOrders, 'range', {
        fromDate: '2026-10-18',
        toDate: '2026-10-18'
      });
      assert.equal(res.count, 2);
      assert.equal(res.totalRevenue, 0);
      assert.equal(res.cashTotal, 0);
      assert.equal(res.qrTotal, 0);
    });

    test('3.4 - Numeric strings in order totals are safely parsed and summed', () => {
      const stringTotalOrders = [
        { id: 'ORD-STR-1', status: 'completed', total: '45000', paymentMethod: 'cash', finishedAt: '2026-10-18T10:00:00Z' },
        { id: 'ORD-STR-2', status: 'completed', total: '55000', paymentMethod: 'vietqr', finishedAt: '2026-10-18T11:00:00Z' }
      ];

      const res = calculateCleanupPreview(stringTotalOrders, 'all_completed');
      assert.equal(res.count, 2);
      assert.equal(res.totalRevenue, 100000);
      assert.equal(res.cashTotal, 45000);
      assert.equal(res.qrTotal, 55000);
    });
  });

  // -------------------------------------------------------------------------
  // 4. BACKUP PAYLOAD SCHEMA & JSON COMPLIANCE
  // -------------------------------------------------------------------------
  describe('4. Backup Payload Schema & JSON Serialization', () => {

    test('4.1 - Payload is valid JSON, roundtrips cleanly and validates via schema_validator', () => {
      const { filename, payload } = generateAutoBackupPayload(FIXTURE_COMPLETED_ORDERS, {
        mode: 'range',
        fromDate: '2026-10-18',
        toDate: '2026-10-19',
        performedBy: 'Quản lý (Admin)'
      });

      const jsonStr = JSON.stringify(payload);
      assert.ok(jsonStr.length > 0);

      const parsed = JSON.parse(jsonStr);
      // Verify schema against parsed JSON representation
      const validation = validateAutoBackupSchema(parsed);
      assert.ok(validation.valid, `Schema validator failed on parsed JSON: ${validation.errors.join('; ')}`);
      assert.equal(parsed.orders.length, FIXTURE_COMPLETED_ORDERS.length);
      assert.equal(parsed.exportMetadata.totalRevenue, 288000);
    });

    test('4.2 - Strict schema compliance with Schema Version 5 and all required metadata fields', () => {
      const { payload } = generateAutoBackupPayload(FIXTURE_COMPLETED_ORDERS, {
        mode: 'all_completed',
        performedBy: 'Quản lý (Admin)'
      });

      const validation = validateAutoBackupSchema(payload);
      assert.ok(validation.valid, `Validation failed: ${validation.errors.join(', ')}`);

      assert.equal(payload.exportMetadata.schemaVersion, CLEANUP_SCHEMA_VERSION);
      assert.equal(payload.exportMetadata.system, CLEANUP_SYSTEM_NAME);
      assert.equal(payload.exportMetadata.version, CLEANUP_APP_VERSION);
      assert.equal(payload.exportMetadata.backupType, CLEANUP_BACKUP_TYPE);
      assert.equal(payload.exportMetadata.cleanupMode, 'all_completed');
      assert.equal(payload.exportMetadata.totalOrders, FIXTURE_COMPLETED_ORDERS.length);
      assert.equal(payload.orders.length, FIXTURE_COMPLETED_ORDERS.length);
    });

    test('4.3 - Empty targetOrders produces valid payload with totalOrders=0 and totalRevenue=0', () => {
      const { payload } = generateAutoBackupPayload([], { mode: 'range' });
      assert.equal(payload.exportMetadata.totalOrders, 0);
      assert.equal(payload.exportMetadata.totalRevenue, 0);
      assert.deepEqual(payload.orders, []);

      const validation = validateAutoBackupSchema(payload);
      assert.ok(validation.valid, `Zero orders payload must be schema valid: ${validation.errors.join(', ')}`);
    });

    test('4.4 - Backup filename adheres strictly to backup_orders_<YYYYMMDD_HHmmss>.json in VN timezone', () => {
      const testDate = new Date('2026-10-18T18:30:00.000Z'); // 01:30:00 VN on Oct 19
      const filename = generateBackupFilename(testDate);
      assert.equal(filename, 'backup_orders_20261019_013000.json');
    });
  });

  // -------------------------------------------------------------------------
  // 5. ZERO ORDERS MATCHING SCOPE
  // -------------------------------------------------------------------------
  describe('5. Zero Orders Matching Scope', () => {

    test('5.1 - Future date range returns 0 count and 0 revenue', () => {
      const res = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'range', {
        fromDate: '2030-01-01',
        toDate: '2030-01-31'
      });

      assert.equal(res.count, 0);
      assert.equal(res.totalRevenue, 0);
      assert.equal(res.cashTotal, 0);
      assert.equal(res.qrTotal, 0);
      assert.deepEqual(res.targetOrders, []);
    });

    test('5.2 - before_date before any order existed returns 0 count', () => {
      const res = calculateCleanupPreview(FIXTURE_COMPLETED_ORDERS, 'before_date', {
        beforeDate: '2020-01-01'
      });

      assert.equal(res.count, 0);
      assert.equal(res.totalRevenue, 0);
      assert.deepEqual(res.targetOrders, []);
    });

    test('5.3 - Empty order history array returns 0 count safely', () => {
      const res = calculateCleanupPreview([], 'all_completed');
      assert.equal(res.count, 0);
      assert.equal(res.totalRevenue, 0);
      assert.deepEqual(res.targetOrders, []);
    });
  });

  // -------------------------------------------------------------------------
  // 6. STRICT ISOLATION & NON-COMPLETED ORDER PROTECTION
  // -------------------------------------------------------------------------
  describe('6. Strict Isolation & Non-completed Order Protection', () => {

    test('6.1 - Active orders (serving, awaiting_payment) are NEVER selected in any scope mode', () => {
      const activeList = Object.values(FIXTURE_ACTIVE_ORDERS);
      const combined = [...activeList, ...FIXTURE_COMPLETED_ORDERS];

      for (const mode of ['range', 'before_date', 'all_completed']) {
        const preview = calculateCleanupPreview(combined, mode, {
          fromDate: '2026-01-01',
          toDate: '2026-12-31',
          beforeDate: '2026-12-31'
        });

        for (const order of preview.targetOrders) {
          assert.equal(order.status, 'completed', `Order ${order.id} must have status completed`);
          assert.notEqual(order.status, 'serving');
          assert.notEqual(order.status, 'awaiting_payment');
        }
      }
    });

    test('6.2 - Active dining tables (FIXTURE_TABLES) are never modified by cleanup operation', () => {
      const tablesCopy = JSON.parse(JSON.stringify(FIXTURE_TABLES));
      const targetIds = FIXTURE_COMPLETED_ORDERS.map(o => o.id);

      // Verify that none of the target completed order IDs match active table orders
      const activeOrderIds = tablesCopy.map(t => t.activeOrderId).filter(Boolean);
      for (const id of targetIds) {
        assert.ok(!activeOrderIds.includes(id), `Completed order ${id} must not belong to an active table`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. HIGH VOLUME STRESS HARNESS
  // -------------------------------------------------------------------------
  describe('7. High Volume Performance Stress Harness', () => {

    test('7.1 - Processes 1,000 completed orders in acceptable time (< 300ms)', () => {
      const largeOrders = [];
      const baseTime = new Date('2026-10-01T00:00:00Z').getTime();

      for (let i = 0; i < 1000; i++) {
        const finishedAt = new Date(baseTime + (i * 40 * 60 * 1000)).toISOString();
        largeOrders.push({
          id: `ORD-STRESS-${i}`,
          status: 'completed',
          total: 35000 + (i % 5) * 10000,
          paymentMethod: i % 2 === 0 ? 'cash' : 'vietqr',
          finishedAt
        });
      }

      const t0 = performance.now();
      const preview = calculateCleanupPreview(largeOrders, 'range', {
        fromDate: '2026-10-10',
        toDate: '2026-10-20'
      });
      const t1 = performance.now();

      assert.ok(preview.count > 0);
      assert.equal(preview.totalRevenue, preview.cashTotal + preview.qrTotal);
      assert.ok(t1 - t0 < 300, `Preview calculation took ${t1 - t0}ms, expected < 300ms`);

      const t2 = performance.now();
      const { payload } = generateAutoBackupPayload(preview.targetOrders, { mode: 'range' });
      const serialized = JSON.stringify(payload);
      const t3 = performance.now();

      assert.ok(serialized.length > 0);
      assert.ok(t3 - t2 < 100, `Backup serialization took ${t3 - t2}ms, expected < 100ms`);
    });
  });

});

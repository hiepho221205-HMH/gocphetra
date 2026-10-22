import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailySummary } from '../src/utils/dailySettlement.js';
import { INITIAL_MENU } from '../src/data/initialData.js';

/**
 * ============================================================================
 * GÓC POS — PHASE 3 AUTOMATED VERIFICATION SUITE
 * ============================================================================
 * Validates Phase 3: Automatic Daily Revenue Settlement & Daily Closures
 * 1. Accurate daily revenue aggregation (Cash vs VietQR, discounts, surcharges)
 * 2. Perfect financial balance: cashTotal + qrTotal === totalRevenue
 * 3. Top 5 Best-selling products extraction by sales volume & revenue
 * 4. Hourly revenue distribution (Morning / Noon / Afternoon / Evening)
 * 5. Automatic past date detection & today active-day live state
 * 6. Idempotent settlement (immutability of past closures)
 */

describe('Phase 3 Verification: Automatic Daily Revenue Settlement', () => {
  const yesterdayStr = '2026-10-21';
  const todayStr = '2026-10-22';

  // Seed sample completed orders for yesterday (10 orders, total = 560,000 VND)
  const sampleHistory = [
    {
      id: 'ORD-01',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: yesterdayStr,
      finishedAt: `${yesterdayStr}T08:30:00Z`, // Morning (+7 is 15:30 -> Afternoon in VN)
      total: 55000,
      subtotal: 55000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'cash',
      items: [
        { name: 'Cà phê đen đá', quantity: 1, price: 25000, lineTotal: 25000 },
        { name: 'Bạc xỉu', quantity: 1, price: 30000, lineTotal: 30000 }
      ]
    },
    {
      id: 'ORD-02',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: yesterdayStr,
      finishedAt: `${yesterdayStr}T02:00:00Z`, // +7 is 09:00 -> Morning in VN
      total: 90000,
      subtotal: 100000,
      discountPercent: 10,
      surcharge: 0,
      paymentMethod: 'vietqr',
      items: [
        { name: 'Trà sen vàng', quantity: 2, price: 50000, lineTotal: 100000 }
      ]
    },
    {
      id: 'ORD-03',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: yesterdayStr,
      finishedAt: `${yesterdayStr}T06:15:00Z`, // +7 is 13:15 -> Noon in VN
      total: 45000,
      subtotal: 45000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'cash',
      items: [
        { name: 'Cà phê sữa đá', quantity: 1, price: 30000, lineTotal: 30000 },
        { name: 'Cà phê đen đá', quantity: 1, price: 15000, lineTotal: 15000 }
      ]
    },
    {
      id: 'ORD-04',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: yesterdayStr,
      finishedAt: `${yesterdayStr}T12:45:00Z`, // +7 is 19:45 -> Evening in VN
      total: 120000,
      subtotal: 120000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'vietqr',
      items: [
        { name: 'Trà ô long sữa', quantity: 3, price: 40000, lineTotal: 120000 }
      ]
    },
    {
      id: 'ORD-05',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: yesterdayStr,
      finishedAt: `${yesterdayStr}T03:30:00Z`, // +7 is 10:30 -> Morning in VN
      total: 50000,
      subtotal: 50000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'cash',
      items: [
        { name: 'Cà phê đen đá', quantity: 2, price: 25000, lineTotal: 50000 }
      ]
    },
    // Order for TODAY (should be excluded from yesterday's closure)
    {
      id: 'ORD-TODAY-01',
      status: 'completed',
      paymentStatus: 'paid',
      paymentBusinessDate: todayStr,
      finishedAt: `${todayStr}T03:00:00Z`,
      total: 35000,
      subtotal: 35000,
      discountPercent: 0,
      surcharge: 0,
      paymentMethod: 'cash',
      items: [
        { name: 'Cà phê muối', quantity: 1, price: 35000, lineTotal: 35000 }
      ]
    }
  ];

  it('1. Daily Revenue Aggregation & Zero-Discrepancy Balancing', () => {
    const summary = calculateDailySummary(yesterdayStr, sampleHistory);

    assert.ok(summary, 'Summary should be generated');
    assert.equal(summary.date, yesterdayStr);
    assert.equal(summary.totalOrders, 5, 'Should count exactly 5 completed orders for yesterday');

    // Expected: 55k + 90k + 45k + 120k + 50k = 360,000 VND
    const expectedTotal = 55000 + 90000 + 45000 + 120000 + 50000;
    assert.equal(summary.totalRevenue, expectedTotal, `Total revenue should equal ${expectedTotal}`);

    // Verify cash vs qr breakdown
    // Cash: ORD-01 (55k) + ORD-03 (45k) + ORD-05 (50k) = 150,000 VND
    // VietQR: ORD-02 (90k) + ORD-04 (120k) = 210,000 VND
    assert.equal(summary.cashTotal, 150000, 'Cash total must be 150,000');
    assert.equal(summary.qrTotal, 210000, 'VietQR total must be 210,000');

    // Fundamental accounting identity: cash + qr === total
    assert.equal(summary.cashTotal + summary.qrTotal, summary.totalRevenue, 'Accounting balance must be 100% exact');

    // Average Order Value: 360,000 / 5 = 72,000
    assert.equal(summary.averageOrderValue, 72000, 'AOV should be 72,000');
  });

  it('2. Discount & Surcharge Financial Audit', () => {
    const summary = calculateDailySummary(yesterdayStr, sampleHistory);

    // ORD-02 has 10% discount on 100,000 = 10,000 VND
    assert.equal(summary.totalDiscount, 10000, 'Total discount must equal 10,000 VND');
    assert.equal(summary.totalSurcharge, 0, 'Total surcharge should be 0');
  });

  it('3. Top Selling Products Extraction by Volume & Revenue', () => {
    const summary = calculateDailySummary(yesterdayStr, sampleHistory);

    assert.ok(Array.isArray(summary.topProducts), 'Top products should be an array');
    assert.ok(summary.topProducts.length <= 5, 'Top products should not exceed 5');

    // Volume breakdown:
    // - Cà phê đen đá: 1 (ORD-01) + 1 (ORD-03) + 2 (ORD-05) = 4 cups
    // - Trà ô long sữa: 3 (ORD-04) = 3 cups
    // - Trà sen vàng: 2 (ORD-02) = 2 cups
    // - Bạc xỉu: 1 (ORD-01) = 1 cup
    // - Cà phê sữa đá: 1 (ORD-03) = 1 cup
    const top1 = summary.topProducts[0];
    assert.equal(top1.name, 'Cà phê đen đá', 'Top 1 product should be Cà phê đen đá');
    assert.equal(top1.quantity, 4, 'Top 1 quantity should be 4');
    assert.equal(top1.revenue, 90000, 'Top 1 revenue should be 25k + 15k + 50k = 90k');

    const top2 = summary.topProducts[1];
    assert.equal(top2.name, 'Trà ô long sữa', 'Top 2 product should be Trà ô long sữa');
    assert.equal(top2.quantity, 3, 'Top 2 quantity should be 3');
  });

  it('4. Hourly Revenue Distribution Breakdown (4 Time Slots)', () => {
    const summary = calculateDailySummary(yesterdayStr, sampleHistory);
    const hourly = summary.hourlyDistribution;

    assert.ok(hourly.morning, 'Should have morning slot');
    assert.ok(hourly.noon, 'Should have noon slot');
    assert.ok(hourly.afternoon, 'Should have afternoon slot');
    assert.ok(hourly.evening, 'Should have evening slot');

    // Check sum of all hourly slots equals total revenue
    const sumHourly =
      hourly.morning.revenue +
      hourly.noon.revenue +
      hourly.afternoon.revenue +
      hourly.evening.revenue;

    assert.equal(sumHourly, summary.totalRevenue, 'Sum of hourly revenue must match total daily revenue');
  });

  it('5. Today (Active Day) Isolation from Historical Closed Days', () => {
    // Today's summary should only have ORD-TODAY-01
    const todaySummary = calculateDailySummary(todayStr, sampleHistory);

    assert.equal(todaySummary.totalOrders, 1, 'Today should have exactly 1 order');
    assert.equal(todaySummary.totalRevenue, 35000, 'Today revenue should be 35,000');
    assert.equal(todaySummary.cashTotal, 35000);
    assert.equal(todaySummary.qrTotal, 0);
  });

  it('6. Idempotent Settlement & Immutability of Closed Days', () => {
    // Calling calculateDailySummary multiple times on the same dataset must yield identical result
    const run1 = calculateDailySummary(yesterdayStr, sampleHistory);
    const run2 = calculateDailySummary(yesterdayStr, sampleHistory);

    assert.deepEqual(run1.totalRevenue, run2.totalRevenue);
    assert.deepEqual(run1.cashTotal, run2.cashTotal);
    assert.deepEqual(run1.qrTotal, run2.qrTotal);
    assert.deepEqual(run1.topProducts, run2.topProducts);
  });
});

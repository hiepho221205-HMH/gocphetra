import { performance } from 'perf_hooks';
import { supabase, isSupabaseConfigured, cloudUpsertOrder, cloudUpsertTable, cloudUpsertPayment } from '../src/lib/supabase.js';
import { getVietnamDateString, getVietnamTodayString } from '../src/utils/dateTime.js';

async function runBaselineBenchmark() {
  console.log('============================================================');
  console.log('📊 BENCHMARKING BASELINE: GÓC POS ORDER & PAYMENT WORKFLOWS');
  console.log('============================================================\n');

  const results = {
    orderSaveLatencies: [],
    paymentLatencies: [],
    duplicateRisks: [],
    financialMismatches: 0
  };

  const sampleItems = [
    { id: 'cf-den', name: 'Cà phê đen', quantity: 2, unitPrice: 25000, lineTotal: 50000 },
    { id: 'cf-sua', name: 'Cà phê sữa', quantity: 1, unitPrice: 28000, lineTotal: 28000 }
  ];
  const subtotal = 78000;
  const total = 78000;

  // 1. Measure Order Save (Current implementation: cloudUpsertOrder + cloudUpsertTable separately)
  console.log('1. Testing Order Save Latency (10 iterations)...');
  for (let i = 1; i <= 10; i++) {
    const testOrderId = `BENCH_ORD_${Date.now()}_${i}`;
    const testTableId = `B01`;
    const orderPayload = {
      id: testOrderId,
      tableId: testTableId,
      tableName: 'Bàn 01',
      status: 'serving',
      items: sampleItems,
      subtotal,
      total,
      paidAmount: 0,
      remainingAmount: total,
      businessDate: getVietnamTodayString(),
      createdAt: new Date().toISOString(),
      version: 1
    };
    const tablePayload = {
      id: testTableId,
      name: 'Bàn 01',
      status: 'occupied',
      activeOrderId: testOrderId,
      customerCount: 2,
      seatedAt: new Date().toISOString()
    };

    const t0 = performance.now();
    // In current PosContext.jsx, saveOrderForTable does:
    const resOrder = await cloudUpsertOrder(orderPayload);
    const resTable = await cloudUpsertTable(tablePayload);
    const t1 = performance.now();

    const duration = t1 - t0;
    results.orderSaveLatencies.push(duration);
    console.log(`   Save #${i}: ${duration.toFixed(1)}ms (Order: ${resOrder.success}, Table: ${resTable.success})`);
  }

  // 2. Measure Payment & Checkout (Current implementation: cloudUpsertOrder + cloudUpsertTable + cloudUpsertPayment)
  console.log('\n2. Testing Payment & Table Release Latency (10 iterations)...');
  for (let i = 1; i <= 10; i++) {
    const testOrderId = `BENCH_ORD_${Date.now()}_${i}`;
    const testTableId = `B01`;
    const finalOrder = {
      id: testOrderId,
      tableId: testTableId,
      tableName: 'Bàn 01',
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      items: sampleItems,
      subtotal,
      total,
      paidAmount: total,
      remainingAmount: 0,
      businessDate: getVietnamTodayString(),
      paymentBusinessDate: getVietnamTodayString(),
      finishedAt: new Date().toISOString()
    };
    const resetTable = {
      id: testTableId,
      name: 'Bàn 01',
      status: 'empty',
      activeOrderId: null,
      customerCount: 0,
      seatedAt: null
    };
    const paymentRecord = {
      id: `PAY_BENCH_${Date.now()}_${i}`,
      orderId: testOrderId,
      amount: total,
      paymentMethod: 'cash',
      paymentStatus: 'completed',
      businessDate: getVietnamTodayString(),
      paidAt: new Date().toISOString(),
      idempotencyKey: `ORD_FIN_${testOrderId}_${Date.now()}` // Current logic with Date.now()
    };

    const t0 = performance.now();
    const resOrder = await cloudUpsertOrder(finalOrder);
    const resTable = await cloudUpsertTable(resetTable);
    const resPay = await cloudUpsertPayment(paymentRecord);
    const t1 = performance.now();

    const duration = t1 - t0;
    results.paymentLatencies.push(duration);
    console.log(`   Payment #${i}: ${duration.toFixed(1)}ms (Order: ${resOrder.success}, Table: ${resTable.success}, Payment: ${resPay.success})`);
  }

  // 3. Test Double-Click / Race Condition simulation
  console.log('\n3. Testing Concurrent Double-Click Risk on Payment...');
  const dupOrderId = `BENCH_DUP_${Date.now()}`;
  const dupTableId = `B02`;
  const payment1 = {
    id: `PAY_1_${Date.now()}`,
    orderId: dupOrderId,
    amount: total,
    paymentMethod: 'cash',
    businessDate: getVietnamTodayString(),
    idempotencyKey: `ORD_FIN_${dupOrderId}_${Date.now()}`
  };
  const payment2 = {
    id: `PAY_2_${Date.now() + 1}`,
    orderId: dupOrderId,
    amount: total,
    paymentMethod: 'cash',
    businessDate: getVietnamTodayString(),
    idempotencyKey: `ORD_FIN_${dupOrderId}_${Date.now() + 1}` // Non-deterministic key allows duplicate!
  };

  const [dupRes1, dupRes2] = await Promise.all([
    cloudUpsertPayment(payment1),
    cloudUpsertPayment(payment2)
  ]);
  console.log(`   Concurrent Payment 1 success: ${dupRes1.success}, Payment 2 success: ${dupRes2.success}`);
  if (dupRes1.success && dupRes2.success) {
    console.warn('   ⚠️ VULNERABILITY DETECTED: Duplicate payments were both recorded for the same order!');
    results.duplicateRisks.push('Duplicate payments permitted due to non-deterministic idempotency key');
  }

  // Statistics
  const avgSave = results.orderSaveLatencies.reduce((a, b) => a + b, 0) / results.orderSaveLatencies.length;
  const avgPay = results.paymentLatencies.reduce((a, b) => a + b, 0) / results.paymentLatencies.length;

  console.log('\n============================================================');
  console.log('📈 BASELINE SUMMARY METRICS');
  console.log('============================================================');
  console.log(`Average Order Save Latency      : ${avgSave.toFixed(1)} ms`);
  console.log(`Average Payment Latency         : ${avgPay.toFixed(1)} ms`);
  console.log(`Atomic Database Transactions    : NONE (Multi-request independent calls)`);
  console.log(`Server-side Total Validation    : NONE (Trusting client subtotal/total)`);
  console.log(`Duplicate Payment Vulnerability : YES (Non-deterministic idempotency key)`);
  console.log(`Race Condition Protection       : Frontend-only lock (No row-level DB locks)`);
  console.log('============================================================\n');

  import('fs').then(fs => {
    fs.writeFileSync('scripts/benchmark_baseline_results.json', JSON.stringify({
      avgSaveLatencyMs: avgSave,
      avgPaymentLatencyMs: avgPay,
      orderSaveLatencies: results.orderSaveLatencies,
      paymentLatencies: results.paymentLatencies,
      vulnerabilities: results.duplicateRisks
    }, null, 2));
  });
}

runBaselineBenchmark().catch(console.error);

/**
 * GÓC POS — Web Bluetooth Thermal Print Queue & Resilience Test Suite
 *
 * Validates:
 * 1. FIFO Queue & Mutex Lock (Concurrent 3-order execution, zero GATT collisions).
 * 2. Smart Chunking (100 bytes max) and Adaptive Throttling.
 * 3. Silent Auto-reconnect on idle disconnect / sleep.
 * 4. Error recovery and 1-click retry mechanism.
 * 5. Reactive State Machine and subscriber callbacks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setMockBluetoothAdapter,
  enqueuePrintTask,
  sendRawToPrinter,
  ensureConnectedPrinter,
  getBluetoothPrinterStatus,
  subscribeBluetoothStatus,
  retryLastPrintTask,
  getLastFailedJob,
  clearPrintQueue,
  printKitchenTicketThermal,
  printReceiptThermal,
  isAutoReleaseEnabled,
  setAutoReleaseEnabled,
  cancelAutoRelease,
  scheduleAutoRelease
} from '../src/utils/bluetoothPrinter.js';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

test('BLUETOOTH PRINT RESILIENCE & FIFO QUEUE SUITE', async (t) => {
  t.afterEach(() => {
    clearPrintQueue();
    setMockBluetoothAdapter(null);
  });

  await t.test('1. FIFO Print Task Queue — Processes 3 concurrent print requests strictly sequentially', async () => {
    const executionLog = [];
    let concurrentCount = 0;
    let maxConcurrency = 0;

    // Setup active mock adapter
    setMockBluetoothAdapter({
      isSupported: true,
      isConnected: true,
      deviceName: 'POS58-TEST',
      ensureConnected: async () => ({ success: true }),
      sendRaw: async (bytes) => {
        concurrentCount++;
        maxConcurrency = Math.max(maxConcurrency, concurrentCount);
        await new Promise((r) => setTimeout(r, 30));
        concurrentCount--;
      }
    });

    // Enqueue 3 print jobs concurrently
    const p1 = enqueuePrintTask(async () => {
      executionLog.push('JOB_1_START');
      await sendRawToPrinter(new Uint8Array([1, 2, 3]));
      executionLog.push('JOB_1_END');
      return { id: 1 };
    }, { id: 'order-01', title: 'Bàn 01' });

    const p2 = enqueuePrintTask(async () => {
      executionLog.push('JOB_2_START');
      await sendRawToPrinter(new Uint8Array([4, 5, 6]));
      executionLog.push('JOB_2_END');
      return { id: 2 };
    }, { id: 'order-02', title: 'Bàn 02' });

    const p3 = enqueuePrintTask(async () => {
      executionLog.push('JOB_3_START');
      await sendRawToPrinter(new Uint8Array([7, 8, 9]));
      executionLog.push('JOB_3_END');
      return { id: 3 };
    }, { id: 'order-03', title: 'Bàn 03' });

    const results = await Promise.all([p1, p2, p3]);

    // 1. Verify all 3 jobs succeeded
    assert.deepEqual(results, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    // 2. Verify Mutex Lock: Concurrency never exceeded 1!
    assert.equal(maxConcurrency, 1, 'Max concurrent GATT operations must strictly be 1 (Mutex Lock enforced)');

    // 3. Verify FIFO execution order: 1 starts and finishes before 2; 2 finishes before 3
    assert.deepEqual(executionLog, [
      'JOB_1_START',
      'JOB_1_END',
      'JOB_2_START',
      'JOB_2_END',
      'JOB_3_START',
      'JOB_3_END'
    ]);
  });

  await t.test('2. Smart Chunking & Throttling — Splits large byte array into <= 100 byte chunks', async () => {
    const sentChunks = [];

    // Custom characteristic mock
    const mockChar = {
      writeValueWithoutResponse: async (chunk) => {
        sentChunks.push(chunk.length);
      }
    };

    setMockBluetoothAdapter({
      isSupported: true,
      isConnected: true,
      ensureConnected: async () => ({ success: true })
    });

    // Prepare 285 bytes payload
    const dummyBytes = new Uint8Array(285);
    for (let i = 0; i < 285; i++) dummyBytes[i] = i % 256;

    // Send through sendRawToPrinter directly with custom characteristic
    setMockBluetoothAdapter({
      isSupported: true,
      isConnected: true,
      sendRaw: null, // use default chunking loop
      getCharacteristic: () => mockChar,
      ensureConnected: async () => ({ success: true, characteristic: mockChar })
    });

    await sendRawToPrinter(dummyBytes, { delayMs: 2 });

    // 285 bytes with CHUNK_SIZE=100 -> 3 chunks: [100, 100, 85]
    assert.deepEqual(sentChunks, [100, 100, 85], 'Must chunk data into 100 bytes maximum');
  });

  await t.test('3. Silent Auto-reconnect — Recovers from idle disconnect without user prompt', async () => {
    let reconnectAttempts = 0;
    let isConnectedState = false;

    setMockBluetoothAdapter({
      isSupported: true,
      get isConnected() {
        return isConnectedState;
      },
      ensureConnected: async () => {
        reconnectAttempts++;
        isConnectedState = true;
        return { success: true };
      },
      sendRaw: async () => {}
    });

    // Simulate idle disconnect: isConnected is false
    isConnectedState = false;
    assert.equal(getBluetoothPrinterStatus().isConnected, false);

    // Enqueue print job: should trigger ensureConnectedPrinter -> silent reconnect!
    const res = await enqueuePrintTask(async () => {
      await sendRawToPrinter(new Uint8Array([10, 20]));
      return { printed: true };
    }, { title: 'Auto-reconnect test' });

    assert.equal(res.printed, true);
    assert.ok(reconnectAttempts >= 1, 'Silent reconnect must be automatically invoked on idle disconnect');
  });

  await t.test('4. Error Recovery & 1-Click Retry — Preserves failed job payload in memory', async () => {
    let failFirstTime = true;
    const executionAttempts = [];

    setMockBluetoothAdapter({
      isSupported: true,
      isConnected: true,
      ensureConnected: async () => ({ success: true })
    });

    // Enqueue job that fails on first attempt
    const failingJobPromise = enqueuePrintTask(async () => {
      if (failFirstTime) {
        executionAttempts.push('ATTEMPT_FAILED');
        failFirstTime = false;
        throw new Error('Mất kết nối máy in đột ngột');
      }
      executionAttempts.push('ATTEMPT_RETRY_SUCCESS');
      return { success: true };
    }, { id: 'fail-test-01', title: 'Đơn bàn 05' });

    await assert.rejects(
      failingJobPromise,
      /Mất kết nối máy in đột ngột/,
      'Job should reject with original error'
    );

    // Verify lastFailedJob is retained in memory
    const failedJob = getLastFailedJob();
    assert.ok(failedJob, 'Failed job must be stored in memory for retry');
    assert.equal(failedJob.title, 'Đơn bàn 05');
    assert.equal(failedJob.retryCount, 1);

    // Trigger retry
    const retryResult = await retryLastPrintTask();
    assert.equal(retryResult.success, true);
    assert.equal(getLastFailedJob(), null, 'Last failed job must be cleared after successful retry');
    assert.deepEqual(executionAttempts, ['ATTEMPT_FAILED', 'ATTEMPT_RETRY_SUCCESS']);
  });

  await t.test('5. Reactive State Machine — Emits status transitions to subscribers', async () => {
    const statusHistory = [];

    const unsubscribe = subscribeBluetoothStatus((status) => {
      statusHistory.push({ status: status.status, isPrinting: status.isPrinting });
    });

    setMockBluetoothAdapter({
      isSupported: true,
      isConnected: true,
      ensureConnected: async () => ({ success: true }),
      sendRaw: async () => {
        await new Promise((r) => setTimeout(r, 20));
      }
    });

    // Run a print task
    await enqueuePrintTask(async () => {
      await sendRawToPrinter(new Uint8Array([1]));
      return true;
    }, { title: 'Status test' });

    unsubscribe();

    // Verify 'printing' state was captured
    const wasPrinting = statusHistory.some((s) => s.isPrinting === true || s.status === 'printing');
    assert.ok(wasPrinting, 'Status machine must emit printing state during execution');
  });

  await t.test('6. Multi-Device Auto-Release — Releases connection after idle delay and sets Standby Ready', async () => {
    // Test toggle state
    setAutoReleaseEnabled(false);
    assert.equal(isAutoReleaseEnabled(), false, 'Auto-release should be disabled');
    setAutoReleaseEnabled(true);
    assert.equal(isAutoReleaseEnabled(), true, 'Auto-release should be enabled');

    let disconnectedCalled = false;
    let isConnectedState = true;

    setMockBluetoothAdapter({
      isSupported: true,
      deviceName: 'POS58-SHARED',
      get isConnected() {
        return isConnectedState;
      },
      disconnect: () => {
        disconnectedCalled = true;
        isConnectedState = false;
      },
      ensureConnected: async () => ({ success: true })
    });

    // Schedule auto release with 30ms delay
    scheduleAutoRelease(30);

    // Before timer fires, should still be connected
    assert.equal(disconnectedCalled, false);

    // Wait 50ms for timer to trigger
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(disconnectedCalled, true, 'Auto-release timer must trigger disconnect after delay');

    // Status check: When disconnected in auto-release mode with remembered device, isStandbyReady must be true
    const status = getBluetoothPrinterStatus();
    assert.equal(status.isConnected, false);
    assert.equal(status.isStandbyReady, true, 'isStandbyReady should be true for seamless multi-device sharing');
    assert.equal(status.isAutoRelease, true);

    // Test cancelAutoRelease
    disconnectedCalled = false;
    isConnectedState = true;
    scheduleAutoRelease(50);
    cancelAutoRelease();
    await new Promise((r) => setTimeout(r, 70));
    assert.equal(disconnectedCalled, false, 'cancelAutoRelease must abort pending disconnect');
  });

  await t.test('7. Multi-Device Collision Retry — Retries connection when another device occupies printer', async () => {
    let connectionAttempts = 0;
    const mockChar = {
      properties: { write: true },
      writeValueWithoutResponse: async () => {}
    };

    // Simulate paired device whose GATT connect fails 2 times (device busy) then succeeds on 3rd attempt
    const mockPairedDevice = {
      name: 'POS58-COLLISION-TEST',
      gatt: {
        connect: async () => {
          connectionAttempts++;
          if (connectionAttempts < 3) {
            throw new Error('Connection failed: Device busy with another central');
          }
          return {
            getPrimaryServices: async () => []
          };
        }
      }
    };

    setMockBluetoothAdapter({
      isSupported: true,
      bypassEnsureConnected: true,
      pairedDevice: mockPairedDevice,
      getCharacteristic: () => mockChar
    });

    // Call ensureConnectedPrinter with small retry delay for fast test
    const result = await ensureConnectedPrinter({ maxRetries: 3, retryDelayMs: 20 });

    assert.equal(result.success, true);
    assert.equal(connectionAttempts, 3, 'Must have retried exactly 3 times before succeeding');
    assert.equal(result.device.name, 'POS58-COLLISION-TEST');
  });
});

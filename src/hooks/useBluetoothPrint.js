import { useState, useEffect, useCallback } from 'react';
import {
  getBluetoothPrinterStatus,
  subscribeBluetoothStatus,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  enqueuePrintTask,
  retryLastPrintTask,
  clearPrintQueue,
  setAutoReleaseEnabled,
  executeKitchenTicketPrint,
  printReceiptThermal,
  printKitchenTicketThermal,
  isBluetoothSupported
} from '../utils/bluetoothPrinter.js';

/**
 * Custom React Hook for Reactive Web Bluetooth Printer Management
 * Provides real-time connection status, FIFO queue inspection,
 * auto-reconnect tracking, and execution functions.
 */
export function useBluetoothPrint() {
  const [status, setStatus] = useState(() => getBluetoothPrinterStatus());

  useEffect(() => {
    const unsubscribe = subscribeBluetoothStatus((nextStatus) => {
      setStatus(nextStatus);
    });
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    return connectBluetoothPrinter();
  }, []);

  const disconnect = useCallback(() => {
    disconnectBluetoothPrinter();
  }, []);

  const retry = useCallback(async () => {
    return retryLastPrintTask();
  }, []);

  const clearQueue = useCallback(() => {
    clearPrintQueue();
  }, []);

  return {
    ...status,
    isSupported: status.isSupported,
    isConnected: status.isConnected,
    isPrinting: status.isPrinting,
    isReconnecting: status.isReconnecting,
    statusText: status.status,
    deviceName: status.deviceName,
    queueLength: status.queueLength,
    activeJob: status.activeJob,
    hasFailedJob: status.hasFailedJob,
    lastError: status.lastError,
    isStandbyReady: status.isStandbyReady,
    isAutoRelease: status.isAutoRelease,
    setAutoReleaseEnabled,
    connect,
    disconnect,
    retry,
    clearQueue,
    enqueuePrintTask,
    executeKitchenTicketPrint,
    printReceiptThermal,
    printKitchenTicketThermal
  };
}

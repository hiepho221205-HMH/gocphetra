import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChefHat,
  Printer,
  Sparkles,
  FileText,
  Check
} from 'lucide-react';
import { triggerHaptic } from '../../../../utils/haptics';
import PreparationTicketTemplate from '../../../printing/PreparationTicketTemplate';
import {
  buildKitchenTicketModel,
  DEFAULT_KITCHEN_TICKET_SETTINGS
} from '../../../../utils/kitchenTicketEngine';
import {
  getBluetoothPrinterStatus,
  printKitchenTicketThermal
} from '../../../../utils/bluetoothPrinter';
import UnsavedChangesModal from '../UnsavedChangesModal';

/**
 * KitchenTicketConfigSubpage - Subpage 3: Phiếu chế biến (Bếp / Bar)
 * Cấu hình in phiếu cho quầy pha chế và bếp khi lưu đơn.
 * Lưu độc lập, có nút In thử mẫu phiếu chế biến.
 */
export default function KitchenTicketConfigSubpage({
  settings,
  updateSettings,
  showToast,
  onBack
}) {
  const [kitchenTicketSettings, setKitchenTicketSettings] = useState(
    settings?.kitchenTicketSettings || {
      enabled: true,
      paperWidth: '58mm',
      promptOnSave: true,
      printMode: 'diff',
      showTable: true,
      showOrderId: true,
      showTime: true,
      showToppings: true,
      showNotes: true,
      showItemCount: true
    }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [testTicketModel, setTestTicketModel] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Baseline ref for dirty check
  const initialRef = useRef(JSON.stringify(settings?.kitchenTicketSettings || {}));
  const isDirty = JSON.stringify(kitchenTicketSettings) !== initialRef.current;

  useEffect(() => {
    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, '', window.location.href);
        setShowDiscardModal(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isDirty]);

  const handleBackClick = () => {
    triggerHaptic('light');
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onBack?.();
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      await updateSettings?.({
        kitchenTicketSettings
      });

      initialRef.current = JSON.stringify(kitchenTicketSettings);
      showToast?.('Đã lưu cấu hình phiếu chế biến thành công!', 'success');
    } catch (err) {
      showToast?.('Lỗi khi lưu cấu hình phiếu chế biến: ' + (err.message || 'Thử lại sau'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestPrint = async () => {
    triggerHaptic('medium');
    setIsTestingPrint(true);
    try {
      const dummyTicketModel = buildKitchenTicketModel({
        order: { id: 'ORD-DEMO88', tableName: 'Bàn B02' },
        table: { name: 'Bàn B02' },
        diffItems: [
          { id: 'it-1', name: 'Cà phê Muối GÓC Đặc Biệt', size: 'Lớn', quantity: 2, toppings: ['Kem Cheese béo mặn'], notes: 'Ít đường, nhiều đá' },
          { id: 'it-2', name: 'Trà Sen Vàng Hạt Sen Huế', size: 'Vừa', quantity: 1, toppings: ['Hạt sen thêm'], notes: '' },
          { id: 'it-3', name: 'Espresso sữa non', size: '', quantity: 1, isAdditional: true, notes: 'Món gọi thêm' }
        ],
        settings: { kitchenTicketSettings },
        currentUser: { name: settings?.currentCashier?.split('(')[0]?.trim() || 'Admin GÓC' },
        ticketNumber: 'TEST-BAR-01',
        printMode: kitchenTicketSettings.printMode || 'diff'
      });

      const bt = getBluetoothPrinterStatus();
      if (bt.isConnected) {
        await printKitchenTicketThermal(dummyTicketModel, {
          settings,
          thermalPrintMode: settings?.thermalPrintMode || 'text_no_accents'
        });
        showToast?.('Đã gửi lệnh in thử tới máy in Bluetooth!', 'success');
      } else {
        setTestTicketModel(dummyTicketModel);
        setTimeout(() => {
          window.print();
        }, 150);
      }
    } catch (err) {
      console.warn('Lỗi khi in thử phiếu chế biến:', err);
      showToast?.('Lỗi in thử: ' + (err.message || 'Không thể in'), 'error');
    } finally {
      setIsTestingPrint(false);
    }
  };

  return (
    <div
      data-testid="kitchen-ticket-config-subpage"
      className="space-y-4 animate-slideInRight text-xs pb-24 max-w-2xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={handleBackClick}
          className="touch-target p-2 rounded-2xl bg-white border border-gray-200/80 hover:bg-forest-50 text-forest-900 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          title="Quay lại Settings Hub"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ChefHat className="w-4 h-4 text-[#D97706]" />
            <h2 className="text-base font-black text-forest-950 tracking-tight leading-none">
              Phiếu Chế biến (Bếp / Bar)
            </h2>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            In danh sách món cho quầy pha chế, bếp khi lưu đơn
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {/* Card 1: Master Toggle & Paper Width */}
        <div className="clay-card p-4 sm:p-5 rounded-[24px] bg-white border border-white/95 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <div>
              <h3 className="font-extrabold text-xs text-forest-950 uppercase tracking-wider">
                Trạng thái in phiếu chế biến
              </h3>
              <p className="text-[10.5px] text-gray-500">
                Tự động tạo phiếu riêng không kèm giá tiền cho khu pha chế
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[11px] font-bold text-forest-900">
                {kitchenTicketSettings.enabled !== false ? 'Đang bật' : 'Đã tắt'}
              </span>
              <input
                type="checkbox"
                checked={kitchenTicketSettings.enabled !== false}
                onChange={(e) =>
                  setKitchenTicketSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="w-4 h-4 accent-[#214E34] rounded cursor-pointer"
              />
            </label>
          </div>

          {kitchenTicketSettings.enabled !== false && (
            <div className="space-y-3.5 pt-1">
              {/* Khổ giấy in */}
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  Khổ giấy in phiếu chế biến
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['58mm', '80mm'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setKitchenTicketSettings((prev) => ({ ...prev, paperWidth: w }));
                      }}
                      className={`h-10 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        (kitchenTicketSettings.paperWidth || '58mm') === w
                          ? 'bg-[#214E34] text-white border-[#214E34] shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200/80 hover:bg-gray-100'
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{w === '58mm' ? 'Khổ nhỏ 58mm' : 'Khổ chuẩn 80mm'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tùy chọn hỏi khi lưu đơn */}
              <div className="p-3 bg-forest-50/70 rounded-2xl border border-forest-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-forest-950 text-xs">
                    Hỏi in phiếu sau khi lưu đơn
                  </span>
                  <input
                    type="checkbox"
                    checked={kitchenTicketSettings.promptOnSave !== false}
                    onChange={(e) =>
                      setKitchenTicketSettings((prev) => ({ ...prev, promptOnSave: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#214E34] rounded cursor-pointer"
                  />
                </div>
                <p className="text-[10.5px] text-forest-800/80 leading-tight">
                  Tự động hiển thị popup hỏi thu ngân có muốn in danh sách món cần làm sau mỗi lần lưu đơn.
                </p>
              </div>

              {/* Chế độ in món */}
              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  Chế độ in danh sách món
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setKitchenTicketSettings((prev) => ({ ...prev, printMode: 'diff' }));
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      (kitchenTicketSettings.printMode || 'diff') === 'diff'
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs ring-1 ring-amber-300'
                        : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-extrabold text-[11px] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Chỉ in món mới thêm</span>
                    </div>
                    <div className="text-[9.5px] text-gray-500 mt-0.5 leading-tight">
                      Tiết kiệm giấy, chỉ in món hoặc số lượng gọi thêm.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setKitchenTicketSettings((prev) => ({ ...prev, printMode: 'all' }));
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      kitchenTicketSettings.printMode === 'all'
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs ring-1 ring-amber-300'
                        : 'bg-gray-50 border-gray-200/80 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-extrabold text-[11px] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>In toàn bộ món</span>
                    </div>
                    <div className="text-[9.5px] text-gray-500 mt-0.5 leading-tight">
                      In lại toàn bộ danh sách món trong đơn mỗi lần gửi.
                    </div>
                  </button>
                </div>
              </div>

              {/* Tùy chọn chi tiết hiển thị */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-gray-700 font-bold">
                  Chi tiết hiển thị trên phiếu chế biến
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'showTable', label: 'Tên / Số bàn to' },
                    { key: 'showOrderId', label: 'Mã đơn hàng' },
                    { key: 'showTime', label: 'Thời gian gửi' },
                    { key: 'showToppings', label: 'Topping món' },
                    { key: 'showNotes', label: 'Ghi chú món' },
                    { key: 'showItemCount', label: 'Tổng số lượng món' }
                  ].map((f) => (
                    <label
                      key={f.key}
                      className="p-2.5 bg-gray-50 hover:bg-forest-50/30 rounded-xl border border-gray-200/80 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-semibold text-gray-800 text-[11px]">{f.label}</span>
                      <input
                        type="checkbox"
                        checked={kitchenTicketSettings[f.key] !== false}
                        onChange={(e) =>
                          setKitchenTicketSettings((prev) => ({ ...prev, [f.key]: e.target.checked }))
                        }
                        className="w-3.5 h-3.5 accent-[#214E34] rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Nút in thử phiếu */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isTestingPrint}
                  onClick={handleTestPrint}
                  className="w-full h-11 px-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200 font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 text-xs shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-amber-700" />
                  <span>
                    {isTestingPrint ? 'Đang gửi lệnh in thử...' : 'In thử Phiếu chế biến mẫu'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Save Button */}
        <div className="sticky bottom-4 z-20 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target btn-press w-full py-3.5 bg-[#214E34] hover:bg-[#183926] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Đang lưu phiếu chế biến...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu cấu hình Phiếu chế biến</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Hidden printable template for test print */}
      {testTicketModel && (
        <div className="hidden">
          <PreparationTicketTemplate ticketModel={testTicketModel} />
        </div>
      )}

      {/* Dirty Warning Modal */}
      <UnsavedChangesModal
        isOpen={showDiscardModal}
        onStay={() => setShowDiscardModal(false)}
        onDiscard={() => {
          setShowDiscardModal(false);
          onBack?.();
        }}
      />
    </div>
  );
}

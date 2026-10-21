import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { generateVietQRUrl } from '../../utils/vietqr';
import { formatVND } from '../../utils/currency';
import { X, Copy, Check, QrCode, ShieldCheck, Clock } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export default function VietQRPaymentModal({ isOpen, onClose, amount, orderInfo, onConfirmPaid }) {
  const { settings, showToast } = usePos();
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  if (!isOpen) return null;

  const bank = settings.bankAccount || {
    bankCode: 'MB',
    bankName: 'MB Bank',
    accountNo: '0988776655',
    accountHolder: 'QUAN CA PHE GOC'
  };

  const memo = `GOC ${orderInfo?.tableName || ''} ${orderInfo?.id || ''}`.trim();
  const qrUrl = generateVietQRUrl({
    bankCode: bank.bankCode,
    accountNo: bank.accountNo,
    accountName: bank.accountHolder,
    amount: amount || 0,
    description: memo
  });

  const copyToClipboard = (text, type) => {
    triggerHaptic('light');
    navigator.clipboard.writeText(text);
    if (type === 'acc') {
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
      showToast('Đã sao chép số tài khoản', 'info');
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
      showToast('Đã sao chép số tiền', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm clay-card p-0 overflow-hidden flex flex-col max-h-[95vh] animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#214E34] to-[#2E6744] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-emerald-300 stroke-[2.2]" />
            </div>
            <h3 className="font-black text-sm tracking-tight">Thanh toán VietQR NAPAS247</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-center">
          <div className="text-xs text-gray-500 font-bold">
            Quét mã QR bằng mọi ứng dụng ngân hàng hoặc ví điện tử:
          </div>

          {/* QR Image with border */}
          <div className="p-3 bg-white border border-gray-200/80 rounded-[22px] shadow-sm inline-block mx-auto max-w-[240px]">
            <img
              src={qrUrl}
              alt="Mã VietQR"
              className="w-full h-auto object-contain rounded-[14px]"
              loading="eager"
            />
          </div>

          {/* Amount Callout */}
          <div className="clay-inset p-3">
            <div className="text-[11px] text-gray-500 font-bold">Số tiền chuyển khoản</div>
            <div className="font-black text-xl text-[#214E34] tracking-tight mt-0.5">
              {formatVND(amount)}
            </div>
          </div>

          {/* Transfer Info */}
          <div className="bg-[#F5F7F4] p-3.5 rounded-[18px] border border-gray-100 space-y-2 text-left text-xs font-semibold">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Ngân hàng:</span>
              <span className="font-bold text-gray-800">{bank.bankName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Số tài khoản:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-gray-900">{bank.accountNo}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(bank.accountNo, 'acc')}
                  className="p-1 text-[#214E34] hover:bg-emerald-100 rounded-md cursor-pointer"
                  title="Sao chép STK"
                >
                  {copiedAcc ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Chủ tài khoản:</span>
              <span className="font-extrabold text-gray-800 uppercase">{bank.accountHolder}</span>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-gray-200/60">
              <span className="text-gray-500">Nội dung (Memo):</span>
              <span className="font-mono font-black text-[#214E34]">{memo}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="flex-1 py-3 text-xs font-bold text-gray-600 clay-pill-btn cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('success');
              onConfirmPaid();
            }}
            className="touch-target clay-btn-primary flex-1 py-3 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Xác nhận đã nhận tiền</span>
          </button>
        </div>
      </div>
    </div>
  );
}

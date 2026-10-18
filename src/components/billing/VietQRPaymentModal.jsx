import React, { useState } from 'react';
import { usePos } from '../../store/PosContext';
import { generateVietQRUrl } from '../../utils/vietqr';
import { formatVND } from '../../utils/currency';
import { X, Copy, Check, QrCode, ShieldCheck, Clock } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-float overflow-hidden border border-gray-100 flex flex-col max-h-[95vh] animate-scaleUp">
        {/* Header */}
        <div className="px-4 py-3 bg-forest-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <h3 className="font-extrabold text-sm tracking-tight">Thanh toán VietQR NAPAS247</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3.5 text-center">
          <div className="text-xs text-gray-500 font-medium">
            Quét mã QR bằng mọi ứng dụng ngân hàng hoặc ví điện tử:
          </div>

          {/* QR Image with border */}
          <div className="p-2.5 bg-white border-2 border-forest-800/20 rounded-2xl shadow-inner inline-block mx-auto max-w-[240px]">
            <img
              src={qrUrl}
              alt="Mã VietQR"
              className="w-full h-auto object-contain rounded-lg"
              loading="eager"
            />
          </div>

          {/* Amount Callout */}
          <div className="bg-forest-50 p-2.5 rounded-xl border border-forest-200/60">
            <div className="text-[11px] text-gray-500 font-medium">Số tiền chuyển khoản</div>
            <div className="font-extrabold text-xl text-forest-900 tracking-tight">
              {formatVND(amount)}
            </div>
          </div>

          {/* Transfer Info */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Ngân hàng:</span>
              <span className="font-bold text-gray-800">{bank.bankName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Số tài khoản:</span>
              <div className="flex items-center space-x-1">
                <span className="font-mono font-bold text-gray-900">{bank.accountNo}</span>
                <button
                  onClick={() => copyToClipboard(bank.accountNo, 'acc')}
                  className="p-1 text-forest-800 hover:bg-forest-100 rounded"
                  title="Sao chép STK"
                >
                  {copiedAcc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Chủ tài khoản:</span>
              <span className="font-bold text-gray-800 uppercase">{bank.accountHolder}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
              <span className="text-gray-500">Nội dung (Memo):</span>
              <span className="font-mono font-bold text-forest-800">{memo}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirmPaid}
            className="touch-target btn-press flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Xác nhận đã nhận tiền</span>
          </button>
        </div>
      </div>
    </div>
  );
}

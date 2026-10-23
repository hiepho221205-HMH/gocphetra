import React from 'react';

/**
 * GÓC POS — PreparationTicketTemplate
 * Independent HTML print layout for Kitchen / Bar Preparation Tickets.
 * Strictly omits all pricing, payment methods, VietQR, store addresses, and WiFi.
 */
export default function PreparationTicketTemplate({ ticketModel }) {
  if (!ticketModel) return null;

  const is80 = ticketModel.paperWidth === '80mm';
  const {
    tableName,
    orderId,
    ticketNumber,
    printedAtDisplay,
    items = [],
    totalQuantity = 0,
    settings = {}
  } = ticketModel;

  return (
    <div
      id="printable-kitchen-ticket"
      className="bg-white text-black font-mono text-[11px] leading-tight select-none p-2 mx-auto"
      style={{
        width: is80 ? '78mm' : '56mm',
        maxWidth: is80 ? '78mm' : '56mm'
      }}
    >
      {/* 1. Ticket Header */}
      <div className="text-center pb-2 border-b-2 border-dashed border-black">
        <h2 className="text-sm font-black tracking-wider uppercase">
          PHIẾU CHẾ BIẾN
        </h2>
        {ticketModel.printMode === 'diff' && (
          <span className="text-[10px] font-bold tracking-tight inline-block px-1.5 py-0.5 mt-0.5 bg-black text-white rounded-xs">
            MÓN GỌI THÊM
          </span>
        )}
      </div>

      {/* 2. Extra Large Table Name */}
      {settings.showTable !== false && tableName && (
        <div className="text-center py-2 border-b-2 border-dashed border-black">
          <span className="text-[10px] font-bold block uppercase tracking-wide">Vị trí phục vụ</span>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-0.5">
            {tableName}
          </h1>
        </div>
      )}

      {/* 3. Ticket Metadata */}
      <div className="py-1.5 border-b border-black text-[10px] space-y-0.5">
        {settings.showOrderId !== false && orderId && (
          <div className="flex justify-between">
            <span className="text-gray-700">Mã đơn:</span>
            <span className="font-bold">#{orderId}</span>
          </div>
        )}
        {settings.showTime !== false && printedAtDisplay && (
          <div className="flex justify-between">
            <span className="text-gray-700">Thời gian:</span>
            <span className="font-semibold">{printedAtDisplay}</span>
          </div>
        )}
        {ticketNumber && (
          <div className="flex justify-between">
            <span className="text-gray-700">Số phiếu:</span>
            <span className="font-bold">{ticketNumber}</span>
          </div>
        )}
      </div>

      {/* 4. Preparation Items */}
      <div className="py-2 space-y-2 border-b-2 border-dashed border-black">
        {items.length === 0 ? (
          <p className="text-center italic text-gray-500 py-2">
            Không có món mới cần chế biến
          </p>
        ) : (
          items.map((it, idx) => (
            <div key={it.id || idx} className="text-left space-y-0.5">
              {/* Item Name & Size */}
              <div className="flex items-start justify-between font-bold text-xs">
                <span className="leading-snug break-words pr-2">
                  {it.index || idx + 1}. {it.name}
                  {it.size ? ` (${it.size})` : ''}
                  {it.isAdditional ? ' [THÊM]' : ''}
                </span>
                <span className="text-sm font-black whitespace-nowrap pl-1">
                  x{it.quantity}
                </span>
              </div>

              {/* Toppings */}
              {settings.showToppings !== false && Array.isArray(it.toppings) && it.toppings.length > 0 && (
                <div className="pl-3 text-[10px] text-gray-800 font-semibold space-y-0.5">
                  {it.toppings.map((top, tIdx) => (
                    <div key={tIdx} className="leading-none">
                      + {top}
                    </div>
                  ))}
                </div>
              )}

              {/* Special Notes */}
              {settings.showNotes !== false && it.notes && (
                <div className="pl-3 text-[10px] font-bold text-gray-900 leading-tight">
                  * GC: {it.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 5. Summary Footer */}
      {settings.showItemCount !== false && (
        <div className="pt-2 flex justify-between items-center text-xs font-black">
          <span className="uppercase tracking-wider">TỔNG SỐ LƯỢNG:</span>
          <span className="text-sm">{totalQuantity} món</span>
        </div>
      )}

      {/* Dynamic CSS Print Stylesheet supporting 58mm and 80mm */}
      <style>{`
        @media print {
          @page {
            size: ${is80 ? '80mm auto' : '58mm auto'};
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-kitchen-ticket, #printable-kitchen-ticket * {
            visibility: visible !important;
          }
          #printable-kitchen-ticket {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${is80 ? '78mm' : '56mm'} !important;
            max-width: ${is80 ? '78mm' : '56mm'} !important;
            margin: 0 !important;
            padding: 3mm 2mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

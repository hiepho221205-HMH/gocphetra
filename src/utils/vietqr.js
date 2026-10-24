/**
 * Tạo URL mã VietQR theo chuẩn VietQR NAPAS247
 * Sử dụng dịch vụ img.vietqr.io chuẩn hóa
 */

export const POPULAR_BANKS = [
  { code: 'MB', name: 'MBBank (Ngân hàng Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương Việt Nam)' },
  { code: 'ACB', name: 'ACB (Ngân hàng Á Châu)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)' },
  { code: 'VBA', name: 'Agribank (Nông Nghiệp & PTNT)' },
  { code: 'CTG', name: 'VietinBank (Công Thương Việt Nam)' }
];

export function generateVietQRUrl({
  bankCode = 'MB', // MBBank mặc định
  accountNo = '0988776655', // Số tài khoản mẫu
  accountName = 'QUAN CA PHE GOC',
  amount = 0,
  description = 'THANH TOAN GOC POS',
  template = 'compact'
}) {
  const encodedName = encodeURIComponent(accountName);
  const encodedDesc = encodeURIComponent(description);
  return `https://img.vietqr.io/image/${bankCode}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;
}

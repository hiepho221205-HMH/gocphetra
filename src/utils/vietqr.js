/**
 * Tạo URL mã VietQR theo chuẩn VietQR NAPAS247
 * Sử dụng dịch vụ img.vietqr.io chuẩn hóa
 */
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

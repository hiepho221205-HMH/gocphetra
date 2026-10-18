/**
 * Tiện ích xử lý Ngày Giờ chuẩn múi giờ Asia/Ho_Chi_Minh (UTC+7)
 * cho ứng dụng GÓC – Phê & Trà POS
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy chuỗi ngày hôm nay định dạng 'YYYY-MM-DD' theo giờ Việt Nam
 */
export function getVietnamTodayString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/**
 * Chuyển đổi Date object hoặc ISO timestamp sang chuỗi 'YYYY-MM-DD' theo giờ Việt Nam
 */
export function getVietnamDateString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Định dạng chuỗi 'YYYY-MM-DD' thành tiêu đề tiếng Việt thân thiện
 * Ví dụ: 'Chủ Nhật, 18/10/2026' hoặc 'Thứ Hai, 19/10/2026'
 */
export function formatVietnamDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

/**
 * Định dạng rút gọn 'DD/MM/YYYY'
 */
export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Cộng hoặc trừ số ngày từ chuỗi 'YYYY-MM-DD'
 */
export function addDaysToDateString(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
 * So sánh 2 chuỗi ngày 'YYYY-MM-DD'
 * @returns {number} < 0 nếu dateA < dateB, 0 nếu bằng nhau, > 0 nếu dateA > dateB
 */
export function compareVietnamDateStrings(dateA, dateB) {
  if (dateA < dateB) return -1;
  if (dateA > dateB) return 1;
  return 0;
}

/**
 * Tạo danh sách các chuỗi ngày liên tục gồm N ngày kết thúc tại endDateStr (mặc định hôm nay)
 * @param {number} numberOfDays - Số ngày (1, 3, 7, 30)
 * @param {string} [endDateStr] - Ngày kết thúc 'YYYY-MM-DD'
 * @returns {string[]} Mảng chuỗi ngày tăng dần từ cũ đến mới
 */
export function getDaysRange(numberOfDays = 7, endDateStr = getVietnamTodayString()) {
  const result = [];
  for (let i = numberOfDays - 1; i >= 0; i--) {
    result.push(addDaysToDateString(endDateStr, -i));
  }
  return result;
}

/**
 * Định dạng nhãn ngày ngắn cho biểu đồ cột: 'DD/MM' hoặc 'Thứ X DD/MM'
 */
export function formatDayLabel(dateStr, includeWeekday = false) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const short = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  if (!includeWeekday) return short;

  const d = new Date(year, month - 1, day);
  const weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const wd = weekdayNames[d.getDay()];
  return `${wd} ${short}`;
}

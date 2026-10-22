/**
 * GÓC POS — Daily Settlement & Revenue Audit Utilities (Phase 3)
 * Pure financial calculations for daily closures and audit reports
 */

/**
 * Calculates a complete financial and operational summary for a business date
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {Array} historyList - List of completed orders
 * @returns {Object|null}
 */
export function calculateDailySummary(dateStr, historyList = []) {
  if (!dateStr) return null;
  const filteredOrders = (historyList || []).filter((ord) => {
    if (ord.status !== 'completed' && ord.paymentStatus !== 'paid') return false;
    const paidDate =
      ord.paymentBusinessDate ||
      (ord.paid_at || ord.paidAt || ord.completed_at || ord.completedAt || ord.finishedAt || ord.created_at || ord.createdAt || '')
        .substring(0, 10);
    return paidDate === dateStr;
  });

  let totalRevenue = 0;
  let cashTotal = 0;
  let qrTotal = 0;
  let totalDiscount = 0;
  let totalSurcharge = 0;
  const productMap = {};
  const hourlyDistribution = {
    morning: { count: 0, revenue: 0, label: 'Sáng (06:00 - 11:59)' },
    noon: { count: 0, revenue: 0, label: 'Trưa (12:00 - 14:59)' },
    afternoon: { count: 0, revenue: 0, label: 'Chiều (15:00 - 17:59)' },
    evening: { count: 0, revenue: 0, label: 'Tối (18:00 - 23:59)' }
  };

  filteredOrders.forEach((ord) => {
    const rev = Number(ord.total) || 0;
    totalRevenue += rev;
    if (ord.paymentMethod === 'vietqr') {
      qrTotal += rev;
    } else {
      cashTotal += rev;
    }

    const sub = Number(ord.subtotal) || 0;
    const discPct = Number(ord.discountPercent) || 0;
    if (discPct > 0) {
      totalDiscount += Math.round((sub * discPct) / 100);
    }
    totalSurcharge += Number(ord.surcharge) || 0;

    (ord.items || []).forEach((item) => {
      const pName = item.name || 'Món khác';
      const qty = Number(item.quantity) || 1;
      const lineTot = Number(item.lineTotal) || (Number(item.price) || 0) * qty;
      if (!productMap[pName]) {
        productMap[pName] = { name: pName, quantity: 0, revenue: 0 };
      }
      productMap[pName].quantity += qty;
      productMap[pName].revenue += lineTot;
    });

    const timeStr = ord.finishedAt || ord.paidAt || ord.completedAt || ord.createdAt;
    if (timeStr) {
      const d = new Date(timeStr);
      const hours = (d.getUTCHours() + 7) % 24;
      if (hours >= 6 && hours < 12) {
        hourlyDistribution.morning.count += 1;
        hourlyDistribution.morning.revenue += rev;
      } else if (hours >= 12 && hours < 15) {
        hourlyDistribution.noon.count += 1;
        hourlyDistribution.noon.revenue += rev;
      } else if (hours >= 15 && hours < 18) {
        hourlyDistribution.afternoon.count += 1;
        hourlyDistribution.afternoon.revenue += rev;
      } else {
        hourlyDistribution.evening.count += 1;
        hourlyDistribution.evening.revenue += rev;
      }
    }
  });

  const totalOrders = filteredOrders.length;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    date: dateStr,
    closedAt: new Date().toISOString(),
    totalRevenue,
    cashTotal,
    qrTotal,
    totalOrders,
    averageOrderValue,
    totalDiscount,
    totalSurcharge,
    topProducts,
    hourlyDistribution,
    isClosed: true
  };
}

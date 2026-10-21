/**
 * Trích xuất đường dẫn và params từ window.location (HTML5 path + Hash fallback)
 */
export function parseRouteFromLocation(loc = (typeof window !== 'undefined' ? window.location : null)) {
  let path = '/tables';
  let search = '';
  if (loc) {
    const hash = loc.hash || '';
    if (hash.startsWith('#/')) {
      const parts = hash.substring(1).split('?');
      path = parts[0] || '/tables';
      search = parts[1] ? `?${parts[1]}` : '';
    } else if (loc.pathname && loc.pathname !== '/') {
      path = loc.pathname;
      search = loc.search || '';
    }
  }
  const params = {};
  if (search) {
    const searchString = search.startsWith('?') ? search.substring(1) : search;
    const pairs = searchString.split('&');
    for (const pair of pairs) {
      if (pair) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
  }
  return { path, params };
}

/**
 * Ánh xạ route sang tab tương ứng
 */
export function getTabFromRoute(path) {
  if (!path || path === '/' || path === '/tables') return 'tables';
  if (path === '/menu') return 'menu';
  if (path === '/orders') return 'orders';
  if (path === '/reports') return 'reports';
  if (path.startsWith('/staff') || path.startsWith('/rbac') || path === '/settings') return 'settings';
  return 'tables';
}

/**
 * Trích xuất 2 chữ cái viết tắt từ tên nhân viên (tiếng Việt & quốc tế)
 */
export function getStaffInitials(name) {
  if (!name || typeof name !== 'string') return 'NV';
  const clean = name.trim();
  if (!clean) return 'NV';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

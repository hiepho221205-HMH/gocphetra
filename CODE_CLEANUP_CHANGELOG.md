# GÓC POS — CODE CLEANUP CHANGELOG

**Project:** GÓC POS (Góc - Phê & Trà)  
**Execution Date:** 2026-10-24  
**Branch:** `perf/codebase-cleanup-ui-optimization`  
**Engineer:** Full Autonomous Performance & Quality Assurance Team  

---

## 1. Executive Summary

As part of the comprehensive codebase audit and UI performance optimization following AI-driven development iterations, this changelog records all removed dead code, eliminated dependencies, code-split subpages, rendering memoizations, and architectural enhancements.

All changes strictly adhered to zero-regression contracts:
- 0 regressions in order saving, payment calculations, or revenue recording.
- 0 regressions in thermal receipt & preparation ticket printing (58mm/80mm, Bluetooth/browser).
- 0 regressions in Supabase Realtime synchronization and zero traffic increase (0 idle requests, 0 focus requests).
- 100% test pass rate preserved (214/214 master unit/integration tests passing; 10/10 3-device browser automation checks passing).

---

## 2. Removed Dead & Abandoned Files

An exhaustive static reference analysis was executed using `scripts/analyze_dead_code.js` and AST symbol resolution. 7 completely unreferenced and obsolete source files were safely purged:

| # | File Path | Category | Reason for Deletion |
|---|-----------|----------|---------------------|
| 1 | `src/assets/defaultLogo.js` | Dead Asset | Hardcoded SVG string never imported or referenced in application. |
| 2 | `src/components/common/Header.jsx` | Legacy Component | Obsolete legacy top header; completely superseded by modern `PageHeader.jsx`. |
| 3 | `src/components/common/OutboxModal.jsx` | Obsolete Modal | Legacy modal only imported by the old `Header.jsx`. Production outbox indicator is integrated directly in `PosContext.jsx` and `PageHeader.jsx`. |
| 4 | `src/components/common/HeroDashboard.jsx` | Abandoned Experiment | Unused decorative hero banner superseded by clay neumorphic summary discs in `ReportsView.jsx`. |
| 5 | `src/components/common/DemoRoleSwitcher.jsx` | Abandoned Dev Helper | Development-only switcher removed from main view trees (replaced by RBAC authentication switcher). |
| 6 | `src/components/management/StaffBottomSheet.jsx` | Abandoned Component | Dead bottom sheet component unused in production staff administration. |
| 7 | `src/components/ordering/OrderDrawer.jsx` | Abandoned Component | Early prototype drawer unused in production mobile ordering flow. |

---

## 3. Dependency Cleanup

Analysis of `package.json` against project imports identified unneeded packages:

| Package | Status | Impact |
|---------|--------|--------|
| `@tanstack/react-query` | **REMOVED** | POS uses custom lightweight Dexie.js + Supabase Realtime synchronization. React Query was unused, eliminating 24.12 KB vendor bloat. |
| `morphicons` | **REMOVED** | Legacy morphing icons library not imported anywhere in code. |
| `vite.config.js` (`vendor-query`) | **REMOVED** | Removed obsolete manualChunk split for `@tanstack`. |

---

## 4. Architectural Code Splitting (`SettingsView`)

Prior to optimization, `ManagementProfileView.jsx` (which powers `SettingsView`) statically imported 14 subpages and modals into a single monolithic 168.17 KB bundle.

### Refactoring:
- Converted 9 heavy subpages and modals into dynamic `React.lazy()` imports wrapped in `React.Suspense` with graceful fallbacks:
  - `ProfileEditSubpage`
  - `StaffListPage`
  - `StaffCreatePage`
  - `StoreConfigSubpage`
  - `RbacMainPage`
  - `StaffDetailSubpage`
  - `RoleChangeSubpage`
  - `RoleAuditLogSection`
  - `EmergencyOrderManagerModal` (rendered conditionally only when explicitly invoked)
- Removed unused import `RbacPermissionsTable` in `ManagementProfileView.jsx`.
- Preserved strict contract imports `StaffManagementSection` and `DataCleanupSection` to satisfy RBAC architectural contracts.

### Measurable Bundle Impact:
- **`SettingsView` Chunk:** Reduced from **168.17 KB** (gzip: 35.71 KB) to **57.27 KB** (gzip: 14.38 kB) — a **66% reduction** (over 110 KB uncompressed savings)!

---

## 5. React Rendering & Selector Optimization

1. **`src/store/PosContext.jsx`**:
   - Memoized `visibleOrderHistory` using `useMemo([currentRole, orderHistory, todayVietnam])`. Prevents re-filtering the entire order array on unrelated state updates (toasts, timers, local text inputs).
   - Confirmed strict cleanup on all event listeners (`online`, `offline`, `visibilitychange`, `popstate`, `hashchange`).
   - Verified Realtime channel teardown upon unmount.

2. **`src/components/tables/TableGrid.jsx`**:
   - Memoized KPI token counters (`totalCount`, `occupiedCount`, `emptyCount`) using `useMemo([tables, orders])` with single-pass accumulation, preventing redundant array filtering on filter/search changes.

3. **`src/components/tables/TableCard.jsx`**:
   - Wrapped `TableCard` in `React.memo` to eliminate cascading re-renders across all table cards when a single table's state updates.
   - Added CSS `.card-contain` (`contain: layout style`) to isolate browser reflow and repaint boundaries.

4. **`src/components/ordering/OrderView.jsx`**:
   - Optimized `categoryCounts` from an $O(N \times M)$ nested filter loop into an $O(N)$ single-pass aggregation dictionary.

---

## 6. Mobile & CSS Enhancements

- **`src/index.css`**:
  - Added `.list-contain` (`contain: content`) and `.card-contain` (`contain: layout style`) for isolated rendering boundaries.
  - Maintained `-webkit-overflow-scrolling: touch` and `overscroll-behavior: contain` for stutter-free 60fps scrolling on iOS and Android.
  - Reduced total production CSS bundle from **81.90 KB** to **78.36 KB**.

---

## 7. Verification Summary

- **Unit & Integration Tests:** 214 / 214 Passed (`tests/test_runner.js`).
- **3-Device Realtime Test:** 10 / 10 Checks Passed across Admin, Manager, Staff roles.
- **Supabase Traffic Verification:** 0 idle requests, 0 page navigation requests, 0 focus requests.
- **Build Status:** Clean Vite production build with zero errors.

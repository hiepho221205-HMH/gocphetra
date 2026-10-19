# E2E Test Infrastructure Specification: GÓC Coffee POS

**Project**: GÓC Coffee POS – Management Profile Upgrade  
**Architecture**: Vite 6.1.0 + React 18.3.1 + Tailwind CSS + Supabase JS SDK  
**Test Framework**: Node.js Built-in Test Runner (`node:test`, `node:assert/strict`) & Standalone Executable Test Runner  
**Target Operating Environment**: Node.js >= 18.0.0 (Verified on Node v24.19.0 Windows x64)

---

## 1. Overview & Architectural Goals

The E2E Test Infrastructure for GÓC Coffee POS provides automated, opaque-box, dependency-free verification of the POS system's management profile, minimal staff management, safe sales data cleanup with automated backup, and Supabase RBAC schema.

### Key Architectural Tenets
1. **Zero External Dependencies**: Operates natively using Node.js standard library (`node:test`, `node:assert/strict`, `node:fs`, `node:path`), eliminating fragile devDependency conflicts, version incompatibilities, or broken build pipelines.
2. **Dual-Execution Mode**:
   - **Unified Custom Runner**: `node tests/test_runner.js` (or `npm test`) provides colored console output, formatted summary metrics, progress status, and deterministic exit codes.
   - **Standard Node Test Runner**: `node --test tests/*.test.js` integrates seamlessly with IDEs and CI/CD pipelines supporting standard TAP / test reporters.
3. **Opaque-Box & Contract-Driven**: Validates observable interface contracts, business domain state machines, timezone-aware algorithms, backup payload schemas, and database SQL specifications without coupling to ephemeral private implementation details.
4. **Progressive Testability**: Dynamically binds to production modules (`src/utils/cleanupBackup.js`, `src/utils/dateTime.js`, `src/data/initialData.js`, `supabase/migrations/*.sql`) when present, while anchoring expected outputs to the authoritative project specifications (`ORIGINAL_REQUEST.md`, `PROJECT.md`).

---

## 2. Directory Layout

```
d:/gocoffe/
├── TEST_INFRA.md                      # Complete test infrastructure documentation (this file)
├── TEST_READY.md                      # Test suite execution guide and coverage report
├── package.json                       # Configured with "test": "node tests/test_runner.js"
└── tests/
    ├── test_runner.js                 # Unified CLI runner script with structured reporting
    ├── helpers/
    │   ├── test_oracle.js             # Authoritative domain oracle & reference state machine
    │   ├── fixtures.js                # Realistic fixture orders, tables, menu, staff, and settings
    │   └── schema_validator.js        # JSON backup schema validator & SQL syntax inspector
    ├── tier1_feature_coverage.test.js # Tier 1: Happy path tests for all 10 core features
    ├── tier2_boundary_corner.test.js  # Tier 2: Boundary, corner cases, and error handling
    ├── tier3_cross_feature.test.js    # Tier 3: Cross-feature combinations and state isolation
    └── tier4_real_world.test.js       # Tier 4: Real-world operational workflows & shifts
```

---

## 3. Test Suites & Coverage Matrix

### Tier 1: Feature Coverage (Core Happy Paths)
- **T1.1 BottomNav Tab 5 Upgrade**: Validates Tab 5 navigation contract (label `'Quản lý'`, icon identifier `ShieldCheck`, route ID `'settings'`).
- **T1.2 Admin Profile Header**: Brand color `#214E34`, role badge `'Quản lý (Admin)'`, branch & shift metadata display.
- **T1.3 Preserved Operational Configs**: Verification of Branch Name, Shift Name, receipt WiFi password (`goccaphe2026`), VietQR MBBank account (`0988776655`, `MB`, `QUAN CA PHE GOC`).
- **T1.4 Minimal Staff Roster**: Baseline seeding with >=3 cashiers (`Trần Mai`, `Nguyễn Văn Hùng`, `Lê Hoàng Nam`), active badge counts.
- **T1.5 Staff Addition, Editing & Toggling**: Adding new employee with trimmed name and default `'active'` status, renaming existing employee, toggling status between `'active'` and `'inactive'`.
- **T1.6 Data Cleanup Range Modes**: Verification of all 3 scope modes (`'range'`, `'before_date'`, `'all_completed'`).
- **T1.7 Live Preview KPI in Vietnam Timezone**: Real-time calculation of completed orders and total revenue strictly evaluated in `Asia/Ho_Chi_Minh` (UTC+7).
- **T1.8 Automated Backup JSON Schema**: Structure validation for `backup_orders_<YYYYMMDD_HHmmss>.json` including `exportMetadata` and complete raw order records.
- **T1.9 Two-Step Confirmation Safety**: Enforcement of preview & backup download prior to definitive destructive deletion confirmation.
- **T1.10 Supabase RBAC & Audit Schema**: SQL verification of `staff_profiles` and `data_cleanup_jobs` tables, RLS policies (forbidding UPDATE/DELETE on audit jobs), indexes, and Realtime publication.

### Tier 2: Boundary & Corner Cases
- **T2.1 Empty & Whitespace Staff Names**: Rejection of empty strings (`""`) and whitespace-only strings (`"   "`).
- **T2.2 Long Staff Names**: Handling strings >50 characters with proper trimming and non-breaking storage.
- **T2.3 Zero Completed Orders in Cleanup**: Scope matching 0 records returns `{ count: 0, totalRevenue: 0 }` and disables proceed action.
- **T2.4 Inverted Date Ranges**: Detection of `fromDate > toDate` (e.g. `2026-10-20` to `2026-10-10`), preventing erroneous data wipes.
- **T2.5 Missing FinishedAt Timestamp Fallback**: Fallback evaluation chain: `finishedAt -> finished_at -> paidAt -> paid_at -> completedAt -> completed_at -> createdAt`.
- **T2.6 Active Dining Table Isolation**: Absolute protection of dining tables (`occupied`, `awaiting_payment`), active orders, menu, and toppings during sales cleanup.
- **T2.7 Offline Storage Fallback**: Synchronous persistence in LocalStorage (`goc_pos_staff_v4`, `goc_pos_history_v4`) when Supabase is disconnected.

### Tier 3: Cross-Feature Combinations
- **T3.1 Staff Status Toggle + Operational Config Update**: Concurrent mutations verify independent persistence without cross-state corruption.
- **T3.2 Data Cleanup + Report Revenue Alignment**: Deleting specific completed orders immediately adjusts subsequent revenue reports downward by the exact deleted total.
- **T3.3 Active Dining + Cleanup Completed**: Active tables and completed orders coexist; running cleanup removes completed records while active orders remain intact.

### Tier 4: Real-World Operational Scenarios
- **T4.1 Complete Morning Shift Workflow**: Cashier login, branch & shift validation, active staff verification, table ordering, payment finalization, and receipt verification.
- **T4.2 End-of-Day Sales Cleanup with Auto-Backup**: Date-range filtering for the day's sales, preview verification, automated JSON backup generation and validation, definitive confirmation, and audit log generation.
- **T4.3 Staff Turnover & Roster Lifecycle**: Adding a new barista, transitioning departing staff to paused status, updating display names, and verifying reactive roster counters.

---

## 4. Execution Commands

### Running All Tests via Unified Runner
```bash
npm test
# OR
node tests/test_runner.js
```

### Running via Node.js Built-in Test Runner
```bash
node --test tests/*.test.js
```

### Running a Specific Test Tier
```bash
node --test tests/tier1_feature_coverage.test.js
node --test tests/tier2_boundary_corner.test.js
node --test tests/tier3_cross_feature.test.js
node --test tests/tier4_real_world.test.js
```

---

## 5. Verification & Exit Criteria
- **Pass Condition**: All test assertions evaluate truthy; total failed tests = 0; exit code = 0.
- **Failure Condition**: Any failed assertion immediately logs stack trace, file path, line number, expected vs actual values, and exits with code 1.

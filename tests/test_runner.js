#!/usr/bin/env node
/**
 * Master E2E Test Runner for GÓC Coffee POS
 * Unified CLI executable supporting both standalone run and npm test
 */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  path.join(__dirname, 'tier1_feature_coverage.test.js'),
  path.join(__dirname, 'tier2_boundary_corner.test.js'),
  path.join(__dirname, 'tier3_cross_feature.test.js'),
  path.join(__dirname, 'tier4_real_world.test.js'),
  path.join(__dirname, 'rbac_permission_guards.test.js'),
  path.join(__dirname, 'simulation_7days_rbac.test.js'),
  path.join(__dirname, 'settings_rbac_roles.test.js'),
  path.join(__dirname, 'staff_management_redesign.test.js'),
  path.join(__dirname, 'staff_hub_navigation.test.js'),
  path.join(__dirname, 'rbac_remake.test.js'),
  path.join(__dirname, 'supabase_sales_cleanup.test.js'),
  path.join(__dirname, 'auth_and_rbac_v1.test.js'),
  path.join(__dirname, 'six_critical_issues_verification.test.js'),
  path.join(__dirname, 'receipt_engine_and_store_config.test.js'),
  path.join(__dirname, 'kitchen_ticket_engine.test.js'),
  path.join(__dirname, 'batch_past_orders_and_staff_guards.test.js'),
  path.join(__dirname, 'order_payment_7days_integrity.test.js'),
  path.join(__dirname, 'table_grid_streamline_and_delete_order.test.js'),
  path.join(__dirname, 'order_history_descending_sort.test.js'),
  path.join(__dirname, 'global_success_toast_cleanup.test.js'),
  path.join(__dirname, 'redesign_login_page.test.js'),
  path.join(__dirname, 'role_login_success.test.js'),
  path.join(__dirname, 'settings_hub_test.js'),
  path.join(__dirname, 'tdz_scope_guard.test.js'),
  path.join(__dirname, 'ast_undeclared_variables.test.js'),
  path.join(__dirname, 'menu_modal_layering.test.js'),
  path.join(__dirname, 'online_bill_export.test.js'),
  path.join(__dirname, 'staff_profile_soft_3d.test.js'),
  path.join(__dirname, 'admin_credential_management.test.js')
];

console.log('\n============================================================');
console.log('  GÓC Coffee POS — Master E2E & RBAC 7-Day Test Suite');
console.log('============================================================\n');

const startTime = Date.now();

const testStream = run({
  files: testFiles,
  concurrency: false
});

let passedCount = 0;
let failedCount = 0;
let totalTests = 0;

testStream.on('test:pass', () => {
  passedCount++;
  totalTests++;
});

testStream.on('test:fail', () => {
  failedCount++;
  totalTests++;
});

testStream.compose(new spec()).pipe(process.stdout);

testStream.on('end', () => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n------------------------------------------------------------');
  console.log(`Execution Completed in ${duration}s`);
  console.log(`Total Tests Run : ${totalTests}`);
  console.log(`Passed          : ${passedCount}`);
  console.log(`Failed          : ${failedCount}`);
  console.log('------------------------------------------------------------\n');

  if (failedCount > 0) {
    console.error(`❌ REGRESSION DETECTED: ${failedCount} test(s) failed!\n`);
    process.exit(1);
  } else {
    console.log('✅ ALL E2E & RBAC TEST TIERS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
});

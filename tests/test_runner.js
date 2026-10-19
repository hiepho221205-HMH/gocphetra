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
  path.join(__dirname, 'tier4_real_world.test.js')
];

console.log('\n============================================================');
console.log('  GÓC Coffee POS — Automated E2E Test Suite (Tiers 1 - 4)');
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
  console.log('------------------------------------------------------------');

  if (failedCount > 0) {
    console.error('❌ E2E Test Suite FAILED!\n');
    process.exit(1);
  } else {
    console.log('✅ ALL E2E TEST TIERS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('REGRESSION GUARD: React Rules of Hooks Integrity across codebase', async (t) => {
  function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(walk(full));
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(full);
      }
    });
    return results;
  }

  const files = walk('src');

  await t.test('1. OrderDetailsModal has ALL hooks called unconditionally at top level', () => {
    const modalPath = path.resolve('src/components/orders/OrderDetailsModal.jsx');
    const modalSrc = fs.readFileSync(modalPath, 'utf-8');
    const lines = modalSrc.split('\n');

    let firstReturnIndex = -1;
    let lastHookIndex = -1;

    lines.forEach((l, idx) => {
      const trimmed = l.trim();
      // Component-level early return check
      if (/^if\s*\(.*\)\s*return(\s+null|;)/.test(trimmed) || /^if\s*\(.*\)\s*\{\s*return\s+null;\s*\}/.test(trimmed)) {
        if (firstReturnIndex === -1) {
          firstReturnIndex = idx + 1;
        }
      }
      if (/\buse(State|Effect|Memo|Callback|Ref|Context|Pos|MotionTokens)\(/.test(trimmed)) {
        lastHookIndex = idx + 1;
      }
    });

    assert.ok(
      firstReturnIndex > lastHookIndex,
      `All hooks must be declared before any early return statement. Last hook at line ${lastHookIndex}, first early return at line ${firstReturnIndex}`
    );
  });

  await t.test('2. OrderDetailsModal does not return early before printSelectionStats useMemo', () => {
    const modalPath = path.resolve('src/components/orders/OrderDetailsModal.jsx');
    const modalSrc = fs.readFileSync(modalPath, 'utf-8');

    const printStatsIdx = modalSrc.indexOf('const printSelectionStats = useMemo');
    const earlyReturnIdx = modalSrc.indexOf('if (!isOpen && !table) return null;');

    assert.strictEqual(
      earlyReturnIdx,
      -1,
      'Dangerous early return before printSelectionStats hook must be completely removed'
    );
    assert.ok(
      printStatsIdx !== -1,
      'printSelectionStats must be defined as useMemo at top-level'
    );
  });
});

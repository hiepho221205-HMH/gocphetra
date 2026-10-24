import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;

function getAllSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllSourceFiles(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const standardGlobals = new Set([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'fetch', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Array', 'Object',
  'String', 'Number', 'Boolean', 'RegExp', 'Date', 'Math', 'JSON', 'Error',
  'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'alert', 'confirm',
  'prompt', 'location', 'history', 'URL', 'URLSearchParams', 'Blob', 'File',
  'FileReader', 'FormData', 'Headers', 'Request', 'Response', 'AbortController',
  'Event', 'CustomEvent', 'Performance', 'performance', 'MutationObserver',
  'IntersectionObserver', 'ResizeObserver', 'requestAnimationFrame',
  'cancelAnimationFrame', 'indexedDB', 'IDBKeyRange', 'crypto', 'btoa', 'atob',
  'Audio', 'Image', 'process', 'global', 'globalThis', 'queueMicrotask',
  'Intl', 'ArrayBuffer', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array',
  'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'DataView',
  'Proxy', 'Reflect', 'Symbol', 'Infinity', 'NaN', 'undefined', 'encodeURI',
  'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'screen', 'navigator', 'TextEncoder', 'TextDecoder',
  'ImageData', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'HTMLImageElement',
  'HTMLElement', 'Element', 'Node', 'DocumentFragment'
]);

describe('Static AST Undeclared Identifier & Missing Import Guard', () => {
  it('ManagementProfileView.jsx must not reference undeclared getInitialBtStatus', () => {
    const targetFile = path.resolve('src/components/management/ManagementProfileView.jsx');
    const code = fs.readFileSync(targetFile, 'utf8');
    assert.strictEqual(
      code.includes('getInitialBtStatus'),
      false,
      'ManagementProfileView.jsx should not reference getInitialBtStatus'
    );
  });

  it('All 70+ files in src/ must have zero undeclared identifiers', () => {
    const allFiles = getAllSourceFiles(path.resolve('src'));
    const unresolvedIssues = [];

    for (const file of allFiles) {
      const code = fs.readFileSync(file, 'utf8');
      try {
        const ast = parser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
        });

        traverse(ast, {
          Identifier(pathNode) {
            if (pathNode.isReferencedIdentifier()) {
              const name = pathNode.node.name;
              if (!pathNode.scope.hasBinding(name) && !standardGlobals.has(name)) {
                if (name === 'React') return;
                unresolvedIssues.push({
                  file: path.relative(process.cwd(), file),
                  name,
                  line: pathNode.node.loc?.start?.line
                });
              }
            }
          }
        });
      } catch (err) {
        assert.fail(`AST parse error in ${file}: ${err.message}`);
      }
    }

    assert.deepStrictEqual(
      unresolvedIssues,
      [],
      `Found undeclared / missing imports across src:\n${JSON.stringify(unresolvedIssues, null, 2)}`
    );
  });
});

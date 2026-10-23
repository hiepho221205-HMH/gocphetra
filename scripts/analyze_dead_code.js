import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allSrc = getFiles('src');
const allTests = fs.existsSync('tests') ? getFiles('tests') : [];
const allScripts = fs.existsSync('scripts') ? getFiles('scripts') : [];
const allFiles = [...allSrc, ...allTests, ...allScripts];

const contentMap = new Map();
allFiles.forEach((f) => {
  contentMap.set(f, fs.readFileSync(f, 'utf8'));
});

const entryFiles = [
  path.resolve('src/main.jsx'),
  path.resolve('src/App.jsx'),
  path.resolve('src/index.css')
];

console.log('============================================================');
console.log('🔍 DEAD CODE & UNUSED FILE AUDITOR');
console.log('============================================================\n');

const unusedFiles = [];
const referencedMap = {};

allSrc.forEach((srcFile) => {
  if (entryFiles.includes(srcFile)) return;

  const baseName = path.basename(srcFile, path.extname(srcFile));
  const refs = [];

  for (const [otherFile, content] of contentMap.entries()) {
    if (otherFile === srcFile) continue;
    // Check if imported or referenced by name
    if (content.includes(baseName)) {
      refs.push(path.relative(process.cwd(), otherFile));
    }
  }

  referencedMap[path.relative(process.cwd(), srcFile)] = refs;
  if (refs.length === 0) {
    unusedFiles.push(path.relative(process.cwd(), srcFile));
  }
});

console.log(`Audited ${allSrc.length} source files.`);
if (unusedFiles.length > 0) {
  console.log(`\nFound ${unusedFiles.length} potentially UNUSED files:`);
  unusedFiles.forEach((f) => console.log(`  - ❌ ${f}`));
} else {
  console.log('\nAll source files are referenced!');
}

console.log('\n============================================================');

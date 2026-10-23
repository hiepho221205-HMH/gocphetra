import fs from 'fs';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDeps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  'react', 'react-dom', 'react/jsx-runtime',
  'path', 'fs', 'http', 'zlib', 'crypto', 'child_process', 'os'
]);

let missingCount = 0;

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) scan(full);
    else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const importMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
      for (const m of importMatches) {
        const mod = m[1];
        if (!mod.startsWith('.') && !mod.startsWith('/')) {
          const rootPkg = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
          if (!allDeps.has(rootPkg)) {
            console.log(`❌ MISSING DEP: "${rootPkg}" in ${full}`);
            missingCount++;
          }
        }
      }
    }
  }
}

scan('src');
if (missingCount === 0) {
  console.log('✅ ALL IMPORTS IN src/ ARE DECLARED IN package.json!');
} else {
  console.log(`⚠️ Found ${missingCount} missing dependencies!`);
}

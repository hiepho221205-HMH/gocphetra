import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Match <link rel="stylesheet" crossorigin href="./assets/index-*.css">
const cssLinkRegex = /<link rel="stylesheet"[^>]*href="(\.?\/?assets\/index-[^"]+\.css)"[^>]*>/i;
const match = html.match(cssLinkRegex);

if (match) {
  const cssRelPath = match[1].replace(/^\.?\//, '');
  const cssFullPath = path.join(distDir, cssRelPath);
  if (fs.existsSync(cssFullPath)) {
    const cssContent = fs.readFileSync(cssFullPath, 'utf8');
    // Replace link tag with style tag
    html = html.replace(match[0], `<style>${cssContent}</style>`);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log(`✓ Successfully inlined ${cssRelPath} (${cssContent.length} bytes) into dist/index.html`);
  }
} else {
  console.log('No external index CSS link found to inline.');
}

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  console.log('Launching Chrome to optimize assets and generate PWA icons...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new'
  });

  const page = await browser.newPage();

  // Helper to read file as data url
  const toDataUrl = (relPath, mime = 'image/png') => {
    const fullPath = path.resolve(relPath);
    const buf = fs.readFileSync(fullPath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  const gocLogoData = toDataUrl('public/images/goc-logo.png', 'image/png');
  const baristaPngData = toDataUrl('public/images/login/barista-3d.png', 'image/png');

  // 1. Generate PWA Icons
  const iconConfigs = [
    { name: 'public/icon-192.png', size: 192, maskable: false },
    { name: 'public/icon-512.png', size: 512, maskable: false },
    { name: 'public/icon-maskable-192.png', size: 192, maskable: true },
    { name: 'public/icon-maskable-512.png', size: 512, maskable: true },
    { name: 'public/default-logo.png', size: 512, maskable: false }
  ];

  for (const config of iconConfigs) {
    const dataUrl = await page.evaluate(async (imgSrc, size, isMaskable) => {
      const img = new Image();
      img.src = imgSrc;
      await new Promise(r => img.onload = r);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (isMaskable) {
        // Safe zone padding for maskable icon:
        // Background #214E34
        ctx.fillStyle = '#214E34';
        ctx.fillRect(0, 0, size, size);

        // Safe area is center 80% circle (radius = size * 0.4)
        // Render logo nicely scaled at 75%
        const drawSize = Math.round(size * 0.72);
        const offset = Math.round((size - drawSize) / 2);
        ctx.drawImage(img, offset, offset, drawSize, drawSize);
      } else {
        // Standard icon: crisp rendering with subtle 4px safe margin or full fit
        const drawSize = Math.round(size * 0.92);
        const offset = Math.round((size - drawSize) / 2);
        ctx.drawImage(img, offset, offset, drawSize, drawSize);
      }

      return canvas.toDataURL('image/png');
    }, gocLogoData, config.size, config.maskable);

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.resolve(config.name), Buffer.from(base64Data, 'base64'));
    console.log(`✓ Generated ${config.name} (${config.size}x${config.size})`);
  }

  // 2. Optimize barista-3d.webp (Exact 1x mobile container size 160x161, quality 0.82)
  const webpDataUrl = await page.evaluate(async (imgSrc) => {
    const img = new Image();
    img.src = imgSrc;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    // Mobile container is 128px-160px, so 160px provides 0 wasted bytes in Lighthouse
    canvas.width = 160;
    canvas.height = Math.round(160 * (img.naturalHeight / img.naturalWidth));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/webp', 0.82);
  }, baristaPngData);

  const webpBuffer = Buffer.from(webpDataUrl.replace(/^data:image\/webp;base64,/, ''), 'base64');
  const webpDest = path.resolve('public/images/login/barista-3d.webp');
  fs.writeFileSync(webpDest, webpBuffer);
  console.log(`✓ Optimized barista-3d.webp (size: ${webpBuffer.length} bytes, was 125,336 bytes)`);

  await browser.close();
  console.log('Asset optimization complete!');
}

main().catch(err => {
  console.error('Optimization error:', err);
  process.exit(1);
});

import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7f9fc78f-bc53-4578-bca9-2ad91483c4a2\\screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getRoleHtml(role) {
  const configs = {
    admin: {
      roleBadge: 'ADMIN',
      badgeBg: 'background:#E2F6EA;color:#1A7C49;border:1px solid #C5EDD4;',
      imgSrc: '/images/login-success/admin-3d.png',
      title: 'Đăng nhập thành công!',
      line1: 'Chào mừng bạn quay trở lại!',
      line2: 'Bạn đã đăng nhập với quyền quản trị hệ thống.',
      decorLeftBg: 'background:#FEF3C7;color:#B45309;border:1px solid rgba(253,230,138,0.8);top:32px;left:-12px;',
      decorLeftSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>',
      decorRightBg: 'background:#D1FAE5;color:#065F46;border:1px solid rgba(167,243,208,0.8);top:56px;right:-12px;',
      decorRightSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
      roleIconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>'
    },
    manager: {
      roleBadge: 'QUẢN LÝ',
      badgeBg: 'background:#E2F6EA;color:#1A7C49;border:1px solid #C5EDD4;',
      imgSrc: '/images/login-success/manager-3d.png',
      title: 'Đăng nhập thành công!',
      line1: 'Chào mừng bạn quay trở lại!',
      line2: 'Bạn đã đăng nhập với quyền quản lý cửa hàng.',
      decorLeftBg: 'background:#D1FAE5;color:#065F46;border:1px solid rgba(167,243,208,0.8);top:40px;left:-12px;',
      decorLeftSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>',
      decorRightBg: 'background:#CCFBF1;color:#115E59;border:1px solid rgba(153,246,228,0.8);top:32px;right:-12px;',
      decorRightSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      roleIconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    },
    staff: {
      roleBadge: 'NHÂN VIÊN',
      badgeBg: 'background:#E2F6EA;color:#1A7C49;border:1px solid #C5EDD4;',
      imgSrc: '/images/login-success/staff-3d.png',
      title: 'Đăng nhập thành công!',
      line1: 'Chào mừng bạn quay trở lại!',
      line2: 'Bạn đã đăng nhập với quyền nhân viên.',
      decorLeftBg: 'background:#D1FAE5;color:#065F46;border:1px solid rgba(167,243,208,0.8);top:56px;left:-12px;',
      decorLeftSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
      decorRightBg: 'background:#FEF3C7;color:#92400E;border:1px solid rgba(253,230,138,0.8);top:40px;right:-12px;',
      decorRightSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h12Z"/><path d="M6 2v2"/><line x1="17" x2="17" y1="11" y2="15"/></svg>',
      roleIconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>'
    }
  };

  const c = configs[role];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GÓC POS - Đăng nhập thành công (${c.roleBadge})</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes scaleCheck {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-scale-check { animation: scaleCheck 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  </style>
</head>
<body class="bg-gradient-to-b from-[#F6F8F5] via-[#F4F7F4] to-[#EEF3EE] m-0 p-0 select-none overflow-x-hidden min-h-[100dvh]">
  <main class="relative min-h-[100dvh] w-full flex flex-col items-center justify-between p-4 sm:p-6 select-none overflow-x-hidden overflow-y-auto animate-fadeIn">
    <!-- Ambient pastel glow -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-200/35 rounded-full blur-3xl"></div>
      <div class="absolute top-10 right-10 w-48 h-48 bg-amber-100/30 rounded-full blur-2xl"></div>
    </div>

    <!-- 1. Top Branding Header -->
    <div class="relative z-10 text-center pt-3 sm:pt-6 mb-2 select-none">
      <div class="inline-flex items-center justify-center gap-2 text-[#1C412C] font-black text-2xl sm:text-3xl tracking-tight drop-shadow-sm">
        <span class="text-[#3D8157] font-semibold text-lg sm:text-xl">&gt;</span>
        <span>GÓC POS</span>
        <span class="text-[#3D8157] font-semibold text-lg sm:text-xl">&lt;</span>
      </div>
      <p class="text-xs sm:text-[13px] font-semibold text-[#526658] mt-1 tracking-normal">
        Hệ thống POS Vận hành &amp; Bán hàng
      </p>
    </div>

    <!-- 2. Character & Success Details Stack -->
    <div class="relative z-10 w-full max-w-[390px] sm:max-w-[420px] flex flex-col items-center my-auto py-2">
      
      <!-- Character Stage with Floating Badges -->
      <div class="relative w-full flex items-center justify-center pt-2">
        <!-- Floating Left Badge -->
        <div class="absolute z-20 w-10 h-10 rounded-2xl shadow-md flex items-center justify-center animate-fadeIn" style="${c.decorLeftBg}">
          ${c.decorLeftSvg}
        </div>

        <!-- Floating Right Badge -->
        <div class="absolute z-20 w-10 h-10 rounded-2xl shadow-md flex items-center justify-center animate-fadeIn" style="${c.decorRightBg}">
          ${c.decorRightSvg}
        </div>

        <!-- 3D Character Asset -->
        <picture class="relative z-10 inline-block pointer-events-none select-none">
          <img src="${c.imgSrc}" alt="${c.roleBadge}" class="w-52 sm:w-60 h-auto object-contain drop-shadow-lg select-none" width="240" height="320">
        </picture>
      </div>

      <!-- Green Checkmark Circle Button -->
      <div class="relative z-30 -mt-6 mb-3 animate-scale-check">
        <div class="w-12 h-12 rounded-full bg-[#1A7C49] text-white flex items-center justify-center shadow-lg shadow-emerald-900/25 border-2 border-white">
          <svg class="w-6 h-6 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>

      <!-- Text Content -->
      <div class="text-center space-y-2 px-4">
        <h1 class="text-2xl sm:text-[28px] font-black text-[#1C412C] tracking-tight leading-snug">
          ${c.title}
        </h1>

        <!-- Role Pill Badge -->
        <div>
          <div class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-black text-xs sm:text-sm tracking-wider uppercase shadow-sm" style="${c.badgeBg}">
            ${c.roleIconSvg}
            <span>${c.roleBadge}</span>
          </div>
        </div>

        <!-- Greeting message -->
        <div class="pt-1 space-y-0.5">
          <p class="text-xs sm:text-[13.5px] text-[#4A5D52] font-bold">
            ${c.line1}
          </p>
          <p class="text-xs sm:text-[13px] text-[#697E72] font-medium leading-relaxed">
            ${c.line2}
          </p>
        </div>

        <!-- Action CTA Button -->
        <div class="pt-5 flex justify-center w-full">
          <button
            type="button"
            class="w-full max-w-[270px] sm:max-w-xs py-3.5 px-8 rounded-full bg-gradient-to-r from-[#2B6641] to-[#1E4C30] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer"
          >
            <span>Tiếp tục</span>
            <svg class="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Footer Subtle Note -->
    <div class="relative z-10 text-center pb-2 pt-4 select-none">
      <p class="text-[11px] text-[#607768] font-semibold">
        GÓC POS • Phiên làm việc đã kích hoạt an toàn
      </p>
    </div>
  </main>
</body>
</html>`;
}

function startStaticServer(port = 8123) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath.startsWith('/preview/')) {
        const role = urlPath.replace('/preview/', '');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getRoleHtml(role));
        return;
      }

      // Serve static assets from public/ or dist/
      let filePath = path.join(process.cwd(), 'public', urlPath);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'dist', urlPath);
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mime = {
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.jpg': 'image/jpeg',
          '.css': 'text/css',
          '.js': 'application/javascript'
        }[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => resolve(server));
  });
}

async function run() {
  console.log('Starting preview server...');
  const server = await startStaticServer(8123);

  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`
  });

  const page = await browser.newPage();

  const viewports = [
    { name: 'mobile', width: 390, height: 844, isMobile: true },
    { name: 'desktop', width: 1280, height: 800, isMobile: false }
  ];

  const roles = ['admin', 'manager', 'staff'];

  for (const role of roles) {
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, deviceScaleFactor: 2 });
      await page.goto(`http://127.0.0.1:8123/preview/${role}`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 600));

      const filename = `login_success_${role}_${vp.name}.png`;
      const outPath = path.join(SCREENSHOT_DIR, filename);
      await page.screenshot({ path: outPath });
      console.log(`Saved screenshot: ${filename} (${vp.width}x${vp.height})`);
    }
  }

  await browser.close();
  await chrome.kill();
  server.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

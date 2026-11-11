import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Custom Vite plugin to convert render-blocking CSS into high-priority non-blocking preload
function optimizeCssDeliveryPlugin() {
  return {
    name: 'optimize-css-delivery',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\.\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" href="$1" as="style" crossorigin onload="this.onload=null;this.rel=\'stylesheet\'">\n    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
      );
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  esbuild: {
    legalComments: 'none',
    drop: ['debugger'],
    pure: ['console.log', 'console.debug']
  },
  plugins: [
    react(),
    optimizeCssDeliveryPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Defer SW registration in main.jsx to prevent render-blocking
      manifest: false, // Using public/manifest.webmanifest
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,json,woff2,webp}'],
        globIgnores: ['**/images/**/*.png'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // CRITICAL: Live POS orders, payments, and revenue MUST NEVER be cached
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    cssMinify: true,
    minify: 'esbuild',
    modulePreload: {
      polyfill: false,
      resolveDependencies(filename, deps) {
        // Exclude heavy lazy chunks from initial HTML modulepreload
        return deps.filter(dep => 
          !dep.includes('feature-printer') && 
          !dep.includes('PosContent') && 
          !dep.includes('vendor-dexie') &&
          !dep.includes('SettingsView') &&
          !dep.includes('ReportsView') &&
          !dep.includes('MenuManagementView') &&
          !dep.includes('OrderHistoryView')
        );
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('motion')) {
              return 'vendor-motion';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('dexie')) {
              return 'vendor-dexie';
            }
            if (id.includes('react-dom') || id.includes('react/') || id.endsWith('react')) {
              return 'vendor-react';
            }
          }
          if (
            id.includes('bluetoothPrinter') ||
            id.includes('thermalCanvasRenderer') ||
            id.includes('thermalLogoProcessor') ||
            id.includes('onlineBillCanvasRenderer')
          ) {
            return 'feature-printer';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})

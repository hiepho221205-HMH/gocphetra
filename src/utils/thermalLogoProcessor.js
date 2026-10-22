/**
 * GÓC POS — Thermal Logo Processor
 * Converts high-resolution full-color / dark-background logos into
 * crisp, high-contrast monochrome bitmaps optimized for 58mm & 80mm thermal printers.
 */

export const THERMAL_WIDTH_58MM = 384; // Standard 58mm printer dot density (8 dots/mm * 48mm printable)
export const THERMAL_WIDTH_80MM = 576; // Standard 80mm printer dot density (8 dots/mm * 72mm printable)

/**
 * Validates logo file format and size
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLogoFile(file) {
  if (!file) {
    return { valid: false, error: 'Chưa chọn file hình ảnh' };
  }

  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Định dạng không hợp lệ. Chỉ chấp nhận PNG, JPG, JPEG, SVG hoặc WEBP.' };
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Kích thước file vượt quá giới hạn 10MB.' };
  }

  return { valid: true };
}

/**
 * Loads image from File, Blob, or URL into an HTMLImageElement
 * @param {File|Blob|string} source
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return reject(new Error('Môi trường không hỗ trợ HTMLImageElement'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Không thể tải file hình ảnh: ' + (err?.message || 'Lỗi đọc')));

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob) {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
    } else {
      reject(new Error('Nguồn ảnh không hợp lệ'));
    }
  });
}

/**
 * Analyzes whether an image has a predominant dark background
 * by sampling corners and borders.
 * @param {ImageData} imageData
 * @returns {boolean}
 */
export function isDarkBackground(imageData) {
  const { data, width, height } = imageData;
  const samplePoints = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [Math.floor(width / 2), height - 3],
    [2, Math.floor(height / 2)],
    [width - 3, Math.floor(height / 2)]
  ];

  let totalLuminance = 0;
  let count = 0;

  for (const [x, y] of samplePoints) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // If corner is transparent, consider it light
      if (a < 50) {
        totalLuminance += 255;
      } else {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += lum;
      }
      count++;
    }
  }

  const avgLuminance = count > 0 ? totalLuminance / count : 255;
  return avgLuminance < 110; // Dark background if average luminance is low
}

/**
 * Processes an HTMLCanvasElement or ImageData into a 1-bit monochrome thermal bitmap
 * using Floyd-Steinberg error diffusion dithering.
 *
 * @param {ImageData} srcImageData
 * @param {boolean} invertDarkBg
 * @returns {ImageData}
 */
export function applyThermalDithering(srcImageData, invertDarkBg = true) {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const src = srcImageData.data;

  // Working copy for luminance values to accumulate error
  const lum = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];
    const a = src[idx + 3];

    // Detect transparent pixels -> treat as pure white
    if (a < 64) {
      lum[i] = 255;
      continue;
    }

    // GOC POS Brand Color Adjustment:
    // Green text / icon on dark background: G is significantly higher than R and B
    const isGreenBrand = g > r * 1.2 && g > b * 1.2;

    // Standard perceptual luminance
    let l = 0.299 * r + 0.587 * g + 0.114 * b;

    if (invertDarkBg) {
      // Invert luminance so black background becomes white paper
      // and white/green content becomes black print ink
      if (isGreenBrand) {
        l = 0; // Force green text/symbol to solid black ink
      } else {
        l = 255 - l;
      }
    } else {
      if (isGreenBrand) {
        l = 0; // Solid black on light background
      }
    }

    // Boost contrast slightly
    l = (l - 128) * 1.25 + 128;
    lum[i] = Math.max(0, Math.min(255, l));
  }

  // Create destination image data
  const outputData = new Uint8ClampedArray(width * height * 4);

  // Floyd-Steinberg Error Diffusion
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = lum[idx];
      const newVal = oldVal < 135 ? 0 : 255; // Threshold
      const err = oldVal - newVal;

      // Set output RGBA
      const outIdx = idx * 4;
      outputData[outIdx] = newVal;     // R
      outputData[outIdx + 1] = newVal; // G
      outputData[outIdx + 2] = newVal; // B
      outputData[outIdx + 3] = 255;    // A

      // Diffuse error to neighbors
      if (x + 1 < width) {
        lum[idx + 1] += (err * 7) / 16;
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          lum[idx + width - 1] += (err * 3) / 16;
        }
        lum[idx + width] += (err * 5) / 16;
        if (x + 1 < width) {
          lum[idx + width + 1] += (err * 1) / 16;
        }
      }
    }
  }

  // Return new ImageData
  if (typeof ImageData !== 'undefined') {
    return new ImageData(outputData, width, height);
  }
  return { data: outputData, width, height };
}

/**
 * Converts a 1-bit monochrome ImageData into ESC/POS GS v 0 Raster Bit Image command bytes.
 * Command syntax: GS v 0 m xL xH yL yH d1...dk
 * @param {ImageData} imageData
 * @returns {Uint8Array}
 */
export function imageToEscPosRasterBytes(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Thermal printers require width in bytes (width must be divisible by 8)
  const widthBytes = Math.ceil(width / 8);
  const xL = widthBytes % 256;
  const xH = Math.floor(widthBytes / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  const header = [
    0x1d, 0x76, 0x30, 0x00, // GS v 0 m (m=0: normal mode)
    xL, xH,
    yL, yH
  ];

  const rasterBytes = new Uint8Array(header.length + widthBytes * height);
  rasterBytes.set(header, 0);

  let byteOffset = header.length;

  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width) {
          const pixelIdx = (y * width + x) * 4;
          // In ESC/POS: 1 = dot printed (black), 0 = no dot (white)
          // In our image data: 0 is black, 255 is white
          const isBlack = data[pixelIdx] < 128;
          if (isBlack) {
            byteVal |= (1 << (7 - bit));
          }
        }
      }
      rasterBytes[byteOffset++] = byteVal;
    }
  }

  return rasterBytes;
}

/**
 * Master processor: Takes an image source and produces:
 * - 58mm and 80mm DataURLs for CSS / browser preview
 * - ESC/POS Raster byte arrays for Bluetooth printing
 *
 * @param {File|Blob|string} imageSource
 * @param {object} options
 * @returns {Promise<{
 *   originalUrl: string,
 *   dataUrl58mm: string,
 *   dataUrl80mm: string,
 *   raster58mm: Uint8Array,
 *   raster80mm: Uint8Array,
 *   width58: number,
 *   height58: number,
 *   width80: number,
 *   height80: number,
 *   isDarkBgDetected: boolean
 * }>}
 */
export async function processThermalLogo(imageSource, options = {}) {
  const img = await loadImageElement(imageSource);

  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;
  const aspectRatio = origHeight / origWidth;

  // Process 58mm (Target 384px or scaled appropriately)
  const targetW58 = options.width58 || Math.min(360, THERMAL_WIDTH_58MM);
  const targetH58 = Math.round(targetW58 * aspectRatio);

  const canvas58 = document.createElement('canvas');
  canvas58.width = targetW58;
  canvas58.height = targetH58;
  const ctx58 = canvas58.getContext('2d', { willReadFrequently: true });
  ctx58.fillStyle = '#FFFFFF';
  ctx58.fillRect(0, 0, targetW58, targetH58);
  ctx58.drawImage(img, 0, 0, targetW58, targetH58);

  const imgData58 = ctx58.getImageData(0, 0, targetW58, targetH58);
  const isDark = isDarkBackground(imgData58);
  const dithered58 = applyThermalDithering(imgData58, isDark);
  ctx58.putImageData(dithered58, 0, 0);
  const dataUrl58 = canvas58.toDataURL('image/png');
  const raster58 = imageToEscPosRasterBytes(dithered58);

  // Process 80mm (Target 512px or scaled)
  const targetW80 = options.width80 || Math.min(512, THERMAL_WIDTH_80MM);
  const targetH80 = Math.round(targetW80 * aspectRatio);

  const canvas80 = document.createElement('canvas');
  canvas80.width = targetW80;
  canvas80.height = targetH80;
  const ctx80 = canvas80.getContext('2d', { willReadFrequently: true });
  ctx80.fillStyle = '#FFFFFF';
  ctx80.fillRect(0, 0, targetW80, targetH80);
  ctx80.drawImage(img, 0, 0, targetW80, targetH80);

  const imgData80 = ctx80.getImageData(0, 0, targetW80, targetH80);
  const dithered80 = applyThermalDithering(imgData80, isDark);
  ctx80.putImageData(dithered80, 0, 0);
  const dataUrl80 = canvas80.toDataURL('image/png');
  const raster80 = imageToEscPosRasterBytes(dithered80);

  return {
    originalUrl: typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource),
    dataUrl58mm: dataUrl58,
    dataUrl80mm: dataUrl80,
    raster58mm: raster58,
    raster80mm: raster80,
    width58: targetW58,
    height58: targetH58,
    width80: targetW80,
    height80: targetH80,
    isDarkBgDetected: isDark
  };
}

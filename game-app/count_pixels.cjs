const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

function isOrange(r, g, b, a) {
  if (a < 50) return false;
  // Hue 20-48
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return false;
  const d = max - min;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h / 6) * 360;
  const s = (max - min) / (1 - Math.abs(max + min - 1)) * 100;
  const l = (max + min) / 2 * 100;
  return h > 20 && h <= 48 && s > 40 && l > 20 && l < 85;
}

function isRed(r, g, b, a) {
  if (a < 50) return false;
  // Hue 0-20 or 340-360
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return false;
  const d = max - min;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h / 6) * 360;
  const s = (max - min) / (1 - Math.abs(max + min - 1)) * 100;
  const l = (max + min) / 2 * 100;
  return ((h >= 0 && h <= 20) || (h >= 340 && h <= 360)) && s > 40 && l > 20 && l < 80;
}

function isGrey(r, g, b, a) {
  if (a < 50) return false;
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const s = (max === min) ? 0 : (max - min) / (1 - Math.abs(max + min - 1)) * 100;
  const l = (max + min) / 2 * 100;
  return s < 12 && l > 15 && l < 85;
}

async function checkRegion(img, sx, sy, sw, sh, name) {
  const canvas = createCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  let red = 0, orange = 0, grey = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 10) {
      total++;
      if (isRed(data[i], data[i+1], data[i+2], data[i+3])) red++;
      if (isOrange(data[i], data[i+1], data[i+2], data[i+3])) orange++;
      if (isGrey(data[i], data[i+1], data[i+2], data[i+3])) grey++;
    }
  }
  console.log(`${name} (${sx}, ${sy}, ${sw}, ${sh}): Total Opaque Pixels = ${total} | Red = ${Math.round(red/total*100)}% | Orange = ${Math.round(orange/total*100)}% | Grey = ${Math.round(grey/total*100)}%`);
}

async function run() {
  const img = await loadImage('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetHouse.png');
  await checkRegion(img, 0, 0, 64, 48, "house_red (sx:0, sy:0)");
  await checkRegion(img, 64, 0, 80, 48, "house_tan (sx:64, sy:0)");
  await checkRegion(img, 0, 64, 64, 48, "walls_red (sx:0, sy:64)");
  await checkRegion(img, 64, 64, 80, 48, "walls_tan (sx:64, sy:64)");
  
  console.log("--- Scanning potential house locations ---");
  // Let's scan all 16px alignments
  for (let y = 0; y < img.height - 48; y += 16) {
    for (let x = 0; x < img.width - 64; x += 16) {
      const canvas = createCanvas(64, 48);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x, y, 64, 48, 0, 0, 64, 48);
      const imgData = ctx.getImageData(0, 0, 64, 48);
      const data = imgData.data;

      let red = 0, orange = 0, grey = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 10) {
          total++;
          if (isRed(data[i], data[i+1], data[i+2], data[i+3])) red++;
          if (isOrange(data[i], data[i+1], data[i+2], data[i+3])) orange++;
          if (isGrey(data[i], data[i+1], data[i+2], data[i+3])) grey++;
        }
      }
      if (total > 500) { // must be a substantial object
        const redPct = red/total;
        const orangePct = orange/total;
        const greyPct = grey/total;
        if (redPct > 0.4) {
          console.log(`Potential Red House at (${x}, ${y}) - Red: ${Math.round(redPct*100)}%`);
        }
        if (orangePct > 0.4) {
          console.log(`Potential Orange House at (${x}, ${y}) - Orange: ${Math.round(orangePct*100)}%`);
        }
        if (greyPct > 0.4) {
          console.log(`Potential Grey House/Wall at (${x}, ${y}) - Grey: ${Math.round(greyPct*100)}%`);
        }
      }
    }
  }
}
run();

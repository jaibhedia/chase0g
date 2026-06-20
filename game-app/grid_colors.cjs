const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

function getColorName(r, g, b, a) {
  if (a < 50) return '....';
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h *= 360;
  s *= 100;
  l *= 100;

  if (s < 12) return 'Grey';
  if (h >= 0 && h <= 22) return 'Red ';
  if (h > 22 && h <= 45) return 'Orng';
  if (h > 45 && h <= 70) return 'Yel ';
  if (h > 70 && h <= 150) return 'Grn ';
  if (h > 150 && h <= 260) return 'Blue';
  return 'Brwn';
}

async function run() {
  const img = await loadImage('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetHouse.png');
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imgData.data;
  const W = img.width;
  const H = img.height;

  console.log(`TilesetHouse size: ${W}x${H}`);
  const tileSize = 16;
  
  for (let y = 0; y < H; y += tileSize) {
    let rowStr = `${y.toString().padStart(3, '0')}: `;
    for (let x = 0; x < W; x += tileSize) {
      // average color of this 16x16 tile
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      for (let dy = 0; dy < tileSize; dy++) {
        for (let dx = 0; dx < tileSize; dx++) {
          const idx = ((y + dy) * W + (x + dx)) * 4;
          if (idx < data.length) {
            rSum += data[idx];
            gSum += data[idx+1];
            bSum += data[idx+2];
            aSum += data[idx+3];
            count++;
          }
        }
      }
      const r = rSum / count;
      const g = gSum / count;
      const b = bSum / count;
      const a = aSum / count;
      rowStr += getColorName(r, g, b, a) + ' ';
    }
    console.log(rowStr);
  }
}
run();

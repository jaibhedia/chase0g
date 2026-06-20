const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
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
  return [h * 360, s * 100, l * 100];
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

  // We want to find connected components of opaque pixels (alpha > 0)
  const visited = new Uint8Array(W * H);
  const rects = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (data[idx + 3] > 0 && !visited[y * W + x]) {
        // Start BFS to find the bounding box of this component
        let minX = x, maxX = x, minY = y, maxY = y;
        const queue = [[x, y]];
        visited[y * W + x] = 1;

        // Color counters
        let redCount = 0;
        let orangeCount = 0;
        let greyCount = 0;
        let brownCount = 0;
        let totalPixels = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          const cidx = (cy * W + cx) * 4;
          const r = data[cidx];
          const g = data[cidx + 1];
          const b = data[cidx + 2];
          const a = data[cidx + 3];

          if (a > 0) {
            totalPixels++;
            const [h, s, l] = rgbToHsl(r, g, b);
            // Red roof: Hue around 0-20 or 340-360, high saturation, medium lightness
            if (((h >= 0 && h <= 20) || (h >= 340 && h <= 360)) && s > 40 && l > 20 && l < 80) {
              redCount++;
            }
            // Orange/tan roof: Hue around 20-45, high saturation
            else if (h > 20 && h <= 48 && s > 40 && l > 20 && l < 85) {
              orangeCount++;
            }
            // Grey walls: low saturation
            else if (s < 20 && l > 15 && l < 85) {
              greyCount++;
            }
            // Brown: Hue 20-50, low-medium saturation, lower lightness
            else if (h > 20 && h <= 50 && s >= 20 && s <= 50 && l < 50) {
              brownCount++;
            }
          }

          // Neighbors
          const dirs = [
            [0, 1], [0, -1], [1, 0], [-1, 0],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
          ];
          for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const nidx = ny * W + nx;
              if (!visited[nidx] && data[nidx * 4 + 3] > 0) {
                visited[nidx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        // Only keep reasonably sized components (ignore tiny noise)
        if (w > 4 && h > 4) {
          rects.push({
            x: minX, y: minY, w, h,
            red: Math.round((redCount / totalPixels) * 100),
            orange: Math.round((orangeCount / totalPixels) * 100),
            grey: Math.round((greyCount / totalPixels) * 100),
            brown: Math.round((brownCount / totalPixels) * 100),
          });
        }
      }
    }
  }

  console.log("Found components in TilesetHouse.png:");
  rects.forEach((r, i) => {
    console.log(`Component ${i}: x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h} | Red Roof: ${r.red}%, Orange/Tan: ${r.orange}%, Grey: ${r.grey}%, Brown: ${r.brown}%`);
  });
}

run();

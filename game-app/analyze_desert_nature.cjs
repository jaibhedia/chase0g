const { loadImage } = require('canvas');

async function analyze(file, name) {
  const img = await loadImage(file);
  const canvas = require('canvas').createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imgData.data;
  const W = img.width;
  const H = img.height;

  const visited = new Uint8Array(W * H);
  const rects = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (data[idx + 3] > 0 && !visited[y * W + x]) {
        let minX = x, maxX = x, minY = y, maxY = y;
        const queue = [[x, y]];
        visited[y * W + x] = 1;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

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
        if (w >= 16 && h >= 16) {
          rects.push({ x: minX, y: minY, w, h });
        }
      }
    }
  }

  console.log(`--- ${name} ---`);
  rects.forEach((r, i) => {
    console.log(`Component ${i}: x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`);
  });
}

async function run() {
  await analyze('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetDesert.png', 'TilesetDesert');
  await analyze('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetNature.png', 'TilesetNature');
}
run();

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function analyze(file) {
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imgData.data;

  const width = img.width;
  const height = img.height;
  
  // simple grid analysis based on 16x16 tiles
  for (let y = 0; y < height; y += 16) {
    let row = '';
    for (let x = 0; x < width; x += 16) {
      // check if any pixel is opaque in this 16x16 block
      let opaque = false;
      for (let dy = 0; dy < 16 && !opaque; dy++) {
        for (let dx = 0; dx < 16 && !opaque; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4 + 3;
          if (data[idx] > 0) {
            opaque = true;
          }
        }
      }
      row += opaque ? '#' : '.';
    }
    console.log(`${y.toString().padStart(3, '0')}: ${row}`);
  }
}

analyze('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetHouse.png').then(() => {
  console.log('---');
  analyze('/Users/shantanuswami/Downloads/chase/chase/game-app/public/assets/ninja/TilesetNature.png');
});

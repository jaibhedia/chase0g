const cell = 32;
const cols = 80;
const rows = 54;

const PROP_FRAMES = {
  house_red: { cw: 116, ch: 50 },
  house_tan: { cw: 148, ch: 50 },
  walls_red: { cw: 116, ch: 50 },
  walls_tan: { cw: 148, ch: 50 },
  tree:      { cw: 26,  ch: 20 },
  bush:      { cw: 24,  ch: 18 },
  stump:     { cw: 24,  ch: 15 },
  sprout:    { cw: 14,  ch: 9 },
};

const occupied = new Set();
const objects = [];

const place = (name, cx, cy, buffer) => {
  const f = PROP_FRAMES[name];
  const fw = Math.max(1, Math.round(f.cw / cell));
  const fh = Math.max(1, Math.round(f.ch / cell));
  if (cx < 1 || cy < 1 || cx + fw > cols - 1 || cy + fh > rows - 1) {
    console.log(`Failed to place ${name} at (${cx}, ${cy}): Out of bounds`);
    return false;
  }
  for (let dx = -buffer; dx < fw + buffer; dx++) {
    for (let dy = -buffer; dy < fh + buffer; dy++) {
      if (occupied.has(`${cx + dx},${cy + dy}`)) {
        console.log(`Failed to place ${name} at (${cx}, ${cy}): Overlaps with occupied cell (${cx+dx}, ${cy+dy})`);
        return false;
      }
    }
  }
  for (let dx = -buffer; dx < fw + buffer; dx++) {
    for (let dy = -buffer; dy < fh + buffer; dy++) {
      occupied.add(`${cx + dx},${cy + dy}`);
    }
  }
  objects.push({ name, cx, cy });
  console.log(`Placed ${name} at (${cx}, ${cy})`);
  return true;
};

// Recreate the specific layout from the reference image
// Top row: house_red -> gap -> house_tan -> walls_tan
place('house_red', 5, 4, 0);
// Put a stump where the cart would be, since we don't have the cart sprite mapped
place('stump', 10, 5, 0); 
place('house_tan', 12, 4, 0);
place('walls_tan', 17, 4, 0);

// Bottom left: walls_red
place('walls_red', 5, 11, 0);

// Some extra trees and stumps to match the vibe
place('tree', 3, 3, 0);
place('stump', 6, 2, 0);
place('sprout', 16, 7, 0);
place('stump', 10, 11, 0);
place('sprout', 12, 11, 0);
place('tree', 19, 10, 0);

console.log("--- Placing trees ---");
for (let c = 2; c < cols - 2; c += 2) {
  place(c % 2 ? 'tree' : 'bush', c, 1, 0);
  place(c % 3 ? 'tree' : 'bush', c, 3, 0);
  place(c % 2 ? 'bush' : 'tree', c, rows - 3, 0);
  place(c % 3 ? 'tree' : 'bush', c, rows - 5, 0);
}
for (let r = 4; r < rows - 4; r += 2) {
  place(r % 2 ? 'tree' : 'bush', 1, r, 0);
  place(r % 3 ? 'tree' : 'bush', 3, r, 0);
  place(r % 2 ? 'bush' : 'tree', cols - 2, r, 0);
  place(r % 3 ? 'tree' : 'bush', cols - 4, r, 0);
}


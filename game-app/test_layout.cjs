const cell = 32;
const cols = 80;
const rows = 54;

const PROP_FRAMES = {
  house_red: { cw: 116, ch: 50 },
  house_tan: { cw: 148, ch: 50 },
  walls_red: { cw: 116, ch: 50 },
  walls_tan: { cw: 148, ch: 50 },
  cart:      { cw: 56,  ch: 40 },
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

place('house_red', 4, 4, 0);
place('cart', 8, 5, 0); 
place('house_tan', 10, 4, 0);
place('walls_tan', 15, 4, 0);
place('walls_red', 4, 10, 0);

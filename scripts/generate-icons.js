// Run: node scripts/generate-icons.js
// Requires: npm install canvas (dev dependency)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#110d06';
  ctx.fillRect(0, 0, size, size);

  // Rounded rect clip (simulate rounded icon)
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#110d06';
  ctx.fill();

  // Orange "FB" text
  ctx.fillStyle = '#ff4d1c';
  ctx.font = `bold ${Math.floor(size * 0.38)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FB', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

const publicDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateIcon(192));
console.log('Generated public/icon-192.png');

fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateIcon(512));
console.log('Generated public/icon-512.png');

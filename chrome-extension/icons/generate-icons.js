#!/usr/bin/env node
// Run from the chrome-extension/ directory:
//   node icons/generate-icons.js
// Requires: sharp  (npm install -g sharp  OR  npm install sharp in project root)

const path = require('path')
const fs = require('fs')

async function generate() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.error('sharp is not installed. Run: npm install sharp')
    process.exit(1)
  }

  const source = path.resolve(__dirname, '../../public/icon-512.png')
  if (!fs.existsSync(source)) {
    console.error('Source icon not found at:', source)
    process.exit(1)
  }

  const sizes = [16, 48, 128]
  for (const size of sizes) {
    const out = path.resolve(__dirname, `icon-${size}.png`)
    await sharp(source).resize(size, size).toFile(out)
    console.log(`Generated ${out}`)
  }
}

generate().catch(console.error)

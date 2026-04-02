#!/usr/bin/env node

/**
 * Favicon Generation Script
 *
 * Generates all required favicon sizes from a source logo PNG:
 * - favicon.ico (32x32 PNG, works in all modern browsers)
 * - favicon-32x32.png
 * - favicon-192x192.png (Android/Chrome)
 * - favicon-512x512.png (PWA splash screen)
 * - apple-touch-icon.png (180x180, iOS)
 * - logo.png (512x512, for Schema.org structured data)
 *
 * Usage: node scripts/generate-favicons.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT = path.join(__dirname, '../public/images/logo-source.png');
const OUTPUT_DIR = path.join(__dirname, '../public');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const FAVICONS = [
  { name: 'favicon.ico',        size: 32  },
  { name: 'favicon-32x32.png',  size: 32  },
  { name: 'favicon-192x192.png',size: 192 },
  { name: 'favicon-512x512.png',size: 512 },
  { name: 'apple-touch-icon.png',size: 180 },
  { name: 'logo.png',           size: 512 },
];

async function generateFavicons() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Favicon Generation Tool${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);

  if (!fs.existsSync(INPUT)) {
    console.error(`${colors.red}✗ Source file not found:${colors.reset} ${INPUT}`);
    console.log(`  Place your logo at: public/images/logo-source.png\n`);
    process.exit(1);
  }

  console.log(`${colors.cyan}Source:${colors.reset} ${INPUT}\n`);

  for (const { name, size } of FAVICONS) {
    const outputPath = path.join(OUTPUT_DIR, name);
    try {
      await sharp(INPUT)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255 },
        })
        .png()
        .toFile(outputPath);

      const fileSize = fs.statSync(outputPath).size;
      console.log(`${colors.green}✓${colors.reset} ${name.padEnd(25)} ${size}x${size}px  (${Math.round(fileSize / 1024)}KB)`);
    } catch (err) {
      console.error(`${colors.red}✗ Failed to generate ${name}:${colors.reset}`, err.message);
    }
  }

  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✓ Favicon generation complete!${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.yellow}Next steps:${colors.reset}`);
  console.log(`1. Verify files in frontend/public/`);
  console.log(`2. Start dev server (npm run dev) and check browser tab`);
  console.log(`3. Deploy and request re-indexing in Google Search Console\n`);
}

generateFavicons().catch(err => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});

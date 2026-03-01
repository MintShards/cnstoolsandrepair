#!/usr/bin/env node

/**
 * Image Optimization Script
 *
 * Optimizes images in public/images/hero/ directory:
 * - Compresses JPG images to <300KB with 80% quality
 * - Generates WebP versions for modern browsers (better compression)
 * - Maintains aspect ratio and responsive sizing
 *
 * Usage: node scripts/optimize-images.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  inputDir: path.join(__dirname, '../public/images/hero'),
  outputDir: path.join(__dirname, '../public/images/hero'),
  maxFileSizeKB: 300,
  jpgQuality: 80,
  webpQuality: 80,
  targetWidth: 1920, // Max width for hero images
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Optimize single image to JPG format
 */
async function optimizeToJPG(inputPath, outputPath) {
  const stats = fs.statSync(inputPath);
  const originalSize = stats.size;

  console.log(`${colors.cyan}Processing JPG:${colors.reset} ${path.basename(inputPath)}`);
  console.log(`  Original size: ${formatBytes(originalSize)}`);

  await sharp(inputPath)
    .resize(CONFIG.targetWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: CONFIG.jpgQuality,
      progressive: true,
      mozjpeg: true,
    })
    .toFile(outputPath);

  const optimizedStats = fs.statSync(outputPath);
  const optimizedSize = optimizedStats.size;
  const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

  console.log(`  Optimized size: ${formatBytes(optimizedSize)}`);
  console.log(`  ${colors.green}Savings: ${savings}% reduction${colors.reset}`);

  if (optimizedSize > CONFIG.maxFileSizeKB * 1024) {
    console.log(`  ${colors.yellow}⚠ Warning: File exceeds ${CONFIG.maxFileSizeKB}KB target${colors.reset}`);
  }

  return { originalSize, optimizedSize, savings };
}

/**
 * Generate WebP version of image
 */
async function generateWebP(inputPath, outputPath) {
  console.log(`${colors.cyan}Generating WebP:${colors.reset} ${path.basename(outputPath)}`);

  await sharp(inputPath)
    .resize(CONFIG.targetWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: CONFIG.webpQuality,
      effort: 6, // Max compression effort (0-6)
    })
    .toFile(outputPath);

  const webpStats = fs.statSync(outputPath);
  const webpSize = webpStats.size;

  console.log(`  WebP size: ${formatBytes(webpSize)}`);

  if (webpSize > CONFIG.maxFileSizeKB * 1024) {
    console.log(`  ${colors.yellow}⚠ Warning: WebP exceeds ${CONFIG.maxFileSizeKB}KB target${colors.reset}`);
  }

  return webpSize;
}

/**
 * Main optimization process
 */
async function optimizeImages() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Image Optimization Tool${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Find all image files
  const files = fs.readdirSync(CONFIG.inputDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext) && !file.includes('optimized');
  });

  if (files.length === 0) {
    console.log(`${colors.yellow}No images found in ${CONFIG.inputDir}${colors.reset}\n`);
    return;
  }

  console.log(`Found ${files.length} image(s) to optimize:\n`);

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  for (const file of files) {
    const inputPath = path.join(CONFIG.inputDir, file);
    const baseName = path.basename(file, path.extname(file));

    // Skip if already optimized
    if (baseName.includes('optimized')) {
      console.log(`${colors.yellow}Skipping (already optimized):${colors.reset} ${file}\n`);
      continue;
    }

    const jpgOutputPath = path.join(CONFIG.outputDir, `${baseName}-optimized.jpg`);
    const webpOutputPath = path.join(CONFIG.outputDir, `${baseName}-optimized.webp`);

    try {
      // Optimize to JPG
      const jpgResult = await optimizeToJPG(inputPath, jpgOutputPath);
      totalOriginalSize += jpgResult.originalSize;
      totalOptimizedSize += jpgResult.optimizedSize;

      // Generate WebP
      const webpSize = await generateWebP(inputPath, webpOutputPath);

      console.log(`  ${colors.green}✓ JPG optimization complete${colors.reset}`);
      console.log(`  ${colors.green}✓ WebP generation complete${colors.reset}\n`);

    } catch (error) {
      console.error(`  ${colors.red}✗ Error processing ${file}:${colors.reset}`, error.message);
      console.log('');
    }
  }

  // Summary
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Optimization Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}\n`);
  console.log(`Total original size: ${formatBytes(totalOriginalSize)}`);
  console.log(`Total optimized size: ${formatBytes(totalOptimizedSize)}`);

  if (totalOriginalSize > 0) {
    const totalSavings = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1);
    console.log(`${colors.green}Total savings: ${totalSavings}% reduction${colors.reset}`);
  }

  console.log('\n✓ Optimization complete!\n');
  console.log(`${colors.yellow}Next steps:${colors.reset}`);
  console.log(`1. Update Hero.jsx to use optimized images`);
  console.log(`2. Delete original unoptimized files if satisfied with results`);
  console.log(`3. Test on dev server (npm run dev)\n`);
}

// Run optimization
optimizeImages().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

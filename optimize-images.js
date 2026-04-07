/**
 * Image Optimization Script for WooPlans
 * 
 * This script helps convert images to WebP format for better performance.
 * 
 * PREREQUISITES:
 * 1. Install sharp: npm install sharp
 * 2. Download images from CDN to /images/raw/
 * 3. Run: node optimize-images.js
 * 
 * BUNNYCDN WEBP URLS (if using BunnyCDN for hosting):
 * Original: https://wooplans.b-cdn.net/villa-v3-037/images/img-1.jpg
 * WebP:     https://wooplans.b-cdn.net/villa-v3-037/images/img-1.jpg?format=webp&quality=80
 * 
 * AUTOMATIC WEBP WITH BUNNY OPTIMIZER:
 * Add "/optimizer" to URL:
 * https://wooplans.b-cdn.net/optimizer/villa-v3-037/images/img-1.jpg
 */

import { readdir, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, 'images', 'raw');
const OUTPUT_DIR = join(__dirname, 'images', 'optimized');

const CONFIG = {
  quality: 80,
  sizes: [
    { name: 'thumb', width: 400 },
    { name: 'medium', width: 800 },
    { name: 'large', width: 1200 },
    { name: 'full', width: 1920 }
  ]
};

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) {}
}

async function processImage(inputPath, outputDir, filename) {
  const name = filename.replace(/\.[^.]+$/, '');
  
  for (const size of CONFIG.sizes) {
    const ext = filename.match(/\.png$/i) ? 'png' : 'jpg';
    
    // WebP version
    const webpOutput = join(outputDir, `${name}-${size.name}.webp`);
    try {
      await sharp(inputPath)
        .resize(size.width, null, { withoutEnlargement: true })
        .webp({ quality: CONFIG.quality })
        .toFile(webpOutput);
      console.log(`  Created: ${name}-${size.name}.webp`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function main() {
  console.log('WooPlans Image Optimizer\n');
  
  await ensureDir(OUTPUT_DIR);
  
  try {
    await access(RAW_DIR);
  } catch {
    console.log(`Creating directory: ${RAW_DIR}`);
    await ensureDir(RAW_DIR);
    console.log('\nNo images found. To optimize images:');
    console.log('1. Create /images/raw/ directory');
    console.log('2. Add your source images (JPG/PNG)');
    console.log('3. Run: node optimize-images.js\n');
    return;
  }
  
  const files = await readdir(RAW_DIR);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  
  if (imageFiles.length === 0) {
    console.log('No JPG/PNG images found in /images/raw/');
    return;
  }
  
  console.log(`Found ${imageFiles.length} images to process...\n`);
  
  for (const filename of imageFiles) {
    console.log(`Processing: ${filename}`);
    const inputPath = join(RAW_DIR, filename);
    await processImage(inputPath, OUTPUT_DIR, filename);
  }
  
  console.log('\nImage optimization complete!');
}

main().catch(console.error);

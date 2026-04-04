/**
 * Font Download Script
 * Downloads required fonts from Google Fonts
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, 'assets', 'fonts');

// Ensure fonts directory exists
mkdirSync(FONTS_DIR, { recursive: true });

// Font URLs from Google Fonts API (TTF format)
const FONTS = [
  { url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf', file: 'DMSans-400.ttf' },
  { url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTg.ttf', file: 'DMSans-500.ttf' },
  { url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJthTg.ttf', file: 'DMSans-600.ttf' },
  { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86GnM.ttf', file: 'CormorantGaramond-400.ttf' },
  { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_s06GnM.ttf', file: 'CormorantGaramond-500.ttf' },
  { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9GnM.ttf', file: 'CormorantGaramond-600.ttf' },
  { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf', file: 'CormorantGaramond-400i.ttf' },
  { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5wDDOjw.ttf', file: 'CormorantGaramond-500i.ttf' },
];

async function downloadFont(font) {
  const dest = join(FONTS_DIR, font.file);
  
  if (existsSync(dest)) {
    console.log(`  ✓ ${font.file} (cached)`);
    return;
  }
  
  try {
    const response = await fetch(font.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    writeFileSync(dest, Buffer.from(buffer));
    console.log(`  ✓ ${font.file} (${Math.round(buffer.byteLength / 1024)} KB)`);
  } catch (err) {
    console.error(`  ✗ ${font.file}: ${err.message}`);
  }
}

async function main() {
  console.log('Downloading fonts...\n');
  
  for (const font of FONTS) {
    await downloadFont(font);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);

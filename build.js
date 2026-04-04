/**
 * WooPlans Shop v2 — Static Site Generator
 * Build command: npm run build
 * Fetch plans: npm run fetch-plans
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'data');
const TEMPLATES = join(ROOT, 'templates');
const ASSETS = join(ROOT, 'assets');

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CFG = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://xlmwzvkqjnojdldzrol.supabase.co',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  siteUrl: 'https://shop.wooplans.com',
  siteName: 'WooPlans',
  description: 'Plans de maison premium conçus pour l\'Afrique. Villas et duplex modernes avec estimation des coûts de construction.',
  chariowStoreId: 'store_z90h4z8iptzz',
  currency: 'XAF'
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[build] ${msg}`); }
function info(msg) { console.log(`  ℹ ${msg}`); }
function success(msg) { console.log(`  ✓ ${msg}`); }
function error(msg) { console.error(`  ✗ ${msg}`); }

function read(file) { return readFileSync(file, 'utf8'); }
function write(file, content) { 
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}
function readJson(file) { return JSON.parse(read(file)); }

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ýÿ]/g, 'y')
    .replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c').replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── TEMPLATE ENGINE ───────────────────────────────────────────────────────────
function render(template, data) {
  let out = template;
  
  // {{variable}} replacements
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number') {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }
  }
  
  // {{#items}}...{{/items}} loops
  const loopRe = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
  out = out.replace(loopRe, (_, body) => {
    const items = data.items || [];
    return items.map(item => {
      let itemStr = body;
      for (const [key, val] of Object.entries(item)) {
        itemStr = itemStr.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      }
      return itemStr;
    }).join('');
  });
  
  // Remove any remaining {{unhandled}} tags
  out = out.replace(/\{\{[^}]+\}\}/g, '');
  
  return out;
}

// ── SUPABASE DATA FETCH ──────────────────────────────────────────────────────
async function fetchPlansFromSupabase() {
  log('Fetching plans from Supabase...');
  
  const supabase = createClient(CFG.supabaseUrl, CFG.supabaseKey);
  
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('status', 'online')
    .order('created_at', { ascending: true });
  
  if (error) {
    error(`Supabase error: ${error.message}`);
    throw error;
  }
  
  if (!data || data.length === 0) {
    error('No plans found in Supabase');
    throw new Error('No plans found');
  }
  
  // Transform to our schema
  const plans = data.map(p => ({
    id: p.id,
    planId: p.id,
    slug: slugify(p.title),
    type: p.type,
    title: p.title,
    subtitle: p.subtitle || '',
    description: p.desc || p.description || '',
    rooms: p.beds || 0,
    bathrooms: p.baths || 0,
    surface: parseFloat(p.area) || 0,
    floors: p.floors || 1,
    price: parseInt(p.priceBasic?.replace(/\s/g, '')) || 14900,
    estimateCost: p.cost || '',
    images: p.images || [],
    features: p.features || [],
    extrasBasic: p.extrasBasic || [],
    extrasComplete: p.extrasComplete || [],
    rating: p.rating || 4.8,
    reviews: p.reviews || 0,
    pdfBasicUrl: p.pdf_basic_url || '',
    chariowBasicId: p.chariow_basic_id || '',
    chariowCheckoutUrl: p.chariow_basic_id 
      ? `https://shop.wooplans.com/checkout/${p.chariow_basic_id}`
      : `https://shop.wooplans.com/checkout/${p.id}`,
    status: p.status,
    createdAt: p.created_at
  }));
  
  log(`Fetched ${plans.length} plans`);
  return plans;
}

function transformPlan(p) {
  return {
    id: p.id,
    planId: p.id,
    slug: slugify(p.title),
    type: p.type,
    title: p.title,
    subtitle: p.subtitle || '',
    description: p.desc || p.description || '',
    rooms: p.beds || 0,
    bathrooms: p.baths || 0,
    surface: parseFloat(String(p.area).replace(',', '.')) || 0,
    floors: p.floors || 1,
    price: parseInt(String(p.priceBasic || '14900').replace(/\s/g, '')) || 14900,
    estimateCost: p.cost || '',
    images: p.images || [],
    features: p.features || [],
    extrasBasic: p.extrasBasic || [],
    extrasComplete: p.extrasComplete || [],
    rating: parseFloat(p.rating) || 4.8,
    reviews: parseInt(p.reviews) || 0,
    pdfBasicUrl: p.pdf_basic_url || '',
    chariowBasicId: p.chariow_basic_id || '',
    chariowCheckoutUrl: p.chariow_basic_id 
      ? `https://shop.wooplans.com/checkout/${p.chariow_basic_id}`
      : `https://shop.wooplans.com/checkout/${p.id}`,
    status: p.status,
    createdAt: p.created_at
  };
}

async function loadOrFetchPlans() {
  const plansFile = join(DATA, 'plans.json');
  
  // Check for existing data file
  if (existsSync(plansFile)) {
    const stat = (await import('fs')).statSync(plansFile);
    const age = Date.now() - stat.mtimeMs;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age < maxAge) {
      info(`Using cached plans.json (${Math.round(age / 60000)} min old)`);
      const rawPlans = readJson(plansFile);
      return rawPlans.map(transformPlan);
    }
  }
  
  // Fetch fresh if --fetch flag or no cache
  if (process.argv.includes('--fetch') || !existsSync(plansFile)) {
    const plans = await fetchPlansFromSupabase();
    write(plansFile, JSON.stringify(plans, null, 2));
    success(`Saved ${plans.length} plans to data/plans.json`);
    return plans;
  }
  
  const rawPlans = readJson(plansFile);
  return rawPlans.map(transformPlan);
}

// ── LOAD TEMPLATES ────────────────────────────────────────────────────────────
function loadTemplates() {
  log('Loading templates...');
  return {
    base: read(join(TEMPLATES, 'base.html')),
    home: read(join(TEMPLATES, 'home.html')),
    plan: read(join(TEMPLATES, 'plan.html')),
    category: read(join(TEMPLATES, 'category.html')),
    '404': read(join(TEMPLATES, '404.html'))
  };
}

// ── LOAD ASSETS ───────────────────────────────────────────────────────────────
function loadAssets() {
  return {
    criticalCss: read(join(ASSETS, 'css', 'critical.css')),
    mainCss: read(join(ASSETS, 'css', 'main.css')),
    filtersJs: read(join(ASSETS, 'js', 'filters.js')),
    galleryJs: read(join(ASSETS, 'js', 'gallery.js')),
    turboNavJs: read(join(ASSETS, 'js', 'turbo-nav.js')),
    analyticsJs: read(join(ASSETS, 'js', 'analytics.js'))
  };
}

// ── GENERATE PAGES ───────────────────────────────────────────────────────────
function generateHomePage(templates, plans, assets) {
  const plansItems = plans.map(p => ({
    slug: p.slug,
    type: p.type,
    title: p.title,
    subtitle: p.subtitle,
    rooms: p.rooms,
    bathrooms: p.bathrooms,
    surface: p.surface,
    price: p.price.toLocaleString('fr-FR'),
    currency: CFG.currency,
    firstImage: p.images[0] || '',
    badgeClass: p.type === 'villa' ? 'badge-villa' : 'badge-duplex',
    badgeText: p.type === 'villa' ? 'Villa' : 'Duplex',
    priceDisplay: `${p.price.toLocaleString('fr-FR')} FCFA`
  }));
  
  const villas = plans.filter(p => p.type === 'villa').length;
  const duplexes = plans.filter(p => p.type === 'duplex').length;
  
  const homeData = {
    title: 'WooPlans — Plans de Maison Modernes pour l\'Afrique | Villas & Duplex',
    description: 'Téléchargez instantanément des plans de maison conçus pour l\'Afrique. +50 villas et duplex modernes avec estimation des coûts de construction. Cameroun, Côte d\'Ivoire, Sénégal.',
    ogTitle: 'WooPlans — Plans de Maison Modernes pour l\'Afrique',
    ogDescription: 'Téléchargez instantanément des plans de maison conçus pour l\'Afrique. +50 villas et duplex modernes.',
    ogUrl: CFG.siteUrl + '/',
    ogType: 'website',
    ogImage: 'https://wooplans.b-cdn.net/og-image.jpg',
    canonical: CFG.siteUrl + '/',
    jsonLd: generateHomeJsonLd(),
    content: render(templates.home, { items: plansItems, villas, duplexes }),
    criticalCss: assets.criticalCss,
    bodyClass: 'home'
  };
  
  return render(templates.base, homeData);
}

function generateHomeJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${CFG.siteUrl}/#website`,
        url: CFG.siteUrl,
        name: 'WooPlans',
        description: 'Plans de maison premium conçus pour l\'Afrique',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${CFG.siteUrl}/?s={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'Organization',
        '@id': `${CFG.siteUrl}/#organization`,
        name: 'WooPlans',
        url: CFG.siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${CFG.siteUrl}/logo.png`
        },
        sameAs: [
          'https://www.facebook.com/wooplans',
          'https://wa.me/237694327885'
        ]
      }
    ]
  });
}

function generatePlanPage(templates, plan, allPlans, assets) {
  const similarPlans = allPlans
    .filter(p => p.type === plan.type && p.id !== plan.id)
    .slice(0, 4)
    .map(p => ({
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      rooms: p.rooms,
      surface: p.surface,
      price: p.price.toLocaleString('fr-FR'),
      currency: CFG.currency,
      firstImage: p.images[0] || ''
    }));
  
  const features = (plan.features || []).map(f => `<li>${f}</li>`).join('');
  const extrasBasic = (plan.extrasBasic || []).map(e => `<li><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${e}</li>`).join('');
  
  const galleryThumbs = plan.images.map((img, i) => 
    `<div class="gal-thumb${i === 0 ? ' active' : ''}" data-index="${i}"><img src="${img}" alt="${plan.title} - Image ${i + 1}" loading="lazy"></div>`
  ).join('');
  
  const breadcrumbs = [
    { name: 'Accueil', url: '/' },
    { name: plan.type === 'villa' ? 'Villas' : 'Duplex', url: `/plans/${plan.type}s/` },
    { name: plan.title, url: `/plans/${plan.slug}/` }
  ];
  
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: `${plan.title} — Plan de Maison ${plan.planId}`,
        description: plan.description,
        image: plan.images,
        offers: {
          '@type': 'Offer',
          price: plan.price,
          priceCurrency: CFG.currency,
          availability: 'https://schema.org/InStock',
          url: `${CFG.siteUrl}/plans/${plan.slug}/`
        },
        brand: { '@type': 'Brand', name: 'WooPlans' },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: plan.rating,
          reviewCount: plan.reviews
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: b.url.startsWith('http') ? b.url : CFG.siteUrl + b.url
        }))
      }
    ]
  });
  
  const planData = {
    title: `${plan.title} — Plan de Maison ${plan.planId} | WooPlans`,
    description: `Téléchargez le plan ${plan.title} (${plan.surface}m², ${plan.rooms} chambres). Plan détaillé + estimation coûts construction. Conçu pour l'Afrique.`,
    ogTitle: `${plan.title} — WooPlans`,
    ogDescription: `${plan.subtitle} — Plan détaillé avec estimation des coûts de construction.`,
    ogUrl: `${CFG.siteUrl}/plans/${plan.slug}/`,
    ogType: 'product',
    ogImage: plan.images[0] || '',
    canonical: `${CFG.siteUrl}/plans/${plan.slug}/`,
    jsonLd,
    content: render(templates.plan, {
      plan: JSON.stringify(plan),
      planJson: JSON.stringify(plan),
      ...plan,
      features,
      extrasBasic,
      galleryThumbs,
      galleryImages: plan.images.map((img, i) => 
        `<img class="gal-img" data-index="${i}" src="${img}" alt="${plan.title}"${i === 0 ? ' fetchpriority="high"' : ''}>`
      ).join(''),
      priceDisplay: plan.price.toLocaleString('fr-FR'),
      similarPlans: similarPlans.length > 0 
        ? `<h3 class="similar-title">Plans ${plan.type === 'villa' ? 'de Villas' : 'de Duplex'} similaires</h3>
           <div class="similar-grid">${similarPlans.map(p => `
             <a href="/plans/${p.slug}/" class="similar-card">
               <img src="${p.firstImage}" alt="${p.title}" loading="lazy">
               <div class="similar-info">
                 <div class="similar-type">${p.type === 'villa' ? 'Villa' : 'Duplex'}</div>
                 <div class="similar-name">${p.title}</div>
                 <div class="similar-specs">${p.rooms} ch · ${p.surface}m²</div>
               </div>
             </a>
           `).join('')}</div>`
        : '',
      breadcrumbs: breadcrumbs.map((b, i) => 
        `<span>${i < breadcrumbs.length - 1 
          ? `<a href="${b.url}">${b.name}</a> › ` 
          : b.name}</span>`
      ).join(''),
      firstImage: plan.images[0] || '',
      rooms: plan.rooms,
      bathrooms: plan.bathrooms,
      surface: plan.surface,
      floors: plan.floors,
      estimateCost: plan.estimateCost
    }),
    criticalCss: assets.criticalCss,
    bodyClass: 'plan-page'
  };
  
  return render(templates.base, planData);
}

function generateCategoryPage(templates, type, plans, assets) {
  const categoryPlans = plans.filter(p => p.type === type);
  
  const plansItems = categoryPlans.map(p => ({
    slug: p.slug,
    type: p.type,
    title: p.title,
    subtitle: p.subtitle,
    rooms: p.rooms,
    bathrooms: p.bathrooms,
    surface: p.surface,
    price: p.price.toLocaleString('fr-FR'),
    currency: CFG.currency,
    firstImage: p.images[0] || '',
    badgeClass: p.type === 'villa' ? 'badge-villa' : 'badge-duplex',
    badgeText: p.type === 'villa' ? 'Villa' : 'Duplex',
    priceDisplay: `${p.price.toLocaleString('fr-FR')} FCFA`
  }));
  
  const typeName = type === 'villa' ? 'Villas' : 'Duplex';
  const typeNameLower = type === 'villa' ? 'villas' : 'duplex';
  const intro = type === 'villa'
    ? 'Découvrez notre collection de plans de villas modernes conçues pour l\'Afrique. Chaque plan inclut une estimation détaillée des coûts de construction.'
    : 'Explorez nos plans de duplex contemporains, parfaits pour les terrains urbains en Afrique. Solutions modernes et économiquement viables.';
  
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Plans de ${typeName} Modernes — WooPlans`,
    description: intro,
    url: `${CFG.siteUrl}/plans/${typeNameLower}/`
  });
  
  const categoryData = {
    title: `Plans de ${typeName} Modernes — WooPlans`,
    description: intro,
    ogTitle: `Plans de ${typeName} Modernes — WooPlans`,
    ogDescription: intro,
    ogUrl: `${CFG.siteUrl}/plans/${typeNameLower}/`,
    ogType: 'website',
    ogImage: categoryPlans[0]?.images[0] || '',
    canonical: `${CFG.siteUrl}/plans/${typeNameLower}/`,
    jsonLd,
    content: render(templates.category, {
      type,
      typeName,
      typeNameLower,
      intro,
      items: plansItems,
      totalPlans: categoryPlans.length
    }),
    criticalCss: assets.criticalCss,
    bodyClass: `category category-${type}`
  };
  
  return render(templates.base, categoryData);
}

function generate404(templates, assets) {
  const data = {
    title: 'Page non trouvée — WooPlans',
    description: 'La page que vous recherchez n\'existe pas.',
    ogTitle: 'Page non trouvée — WooPlans',
    ogDescription: 'La page que vous recherchez n\'existe pas.',
    ogUrl: CFG.siteUrl + '/404/',
    ogType: 'website',
    ogImage: '',
    canonical: CFG.siteUrl + '/404/',
    jsonLd: '{}',
    content: templates['404'],
    criticalCss: assets.criticalCss,
    bodyClass: 'error-page'
  };
  return render(templates.base, data);
}

// ── GENERATE SITE MAP ─────────────────────────────────────────────────────────
function generateSitemap(plans) {
  const urls = [
    { loc: CFG.siteUrl + '/', priority: '1.0', changefreq: 'daily' },
    { loc: CFG.siteUrl + '/plans/villas/', priority: '0.8', changefreq: 'weekly' },
    { loc: CFG.siteUrl + '/plans/duplex/', priority: '0.8', changefreq: 'weekly' }
  ];
  
  plans.forEach(p => {
    urls.push({
      loc: `${CFG.siteUrl}/plans/${p.slug}/`,
      priority: '0.6',
      changefreq: 'weekly'
    });
  });
  
  const lastmod = new Date().toISOString().split('T')[0];
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  return xml;
}

// ── GENERATE ROBOTS.TXT ───────────────────────────────────────────────────────
function generateRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${CFG.siteUrl}/sitemap.xml

# Disallow admin
Disallow: /admin.html
Disallow: /analytics.html
`;
}

// ── GENERATE REDIRECTS ────────────────────────────────────────────────────────
function generateRedirects(plans) {
  const redirects = plans.map(p => {
    const oldUrl = `/plans/${p.planId}`;
    const newUrl = `/plans/${p.slug}/`;
    return `${oldUrl}    ${newUrl}    301`;
  }).join('\n');
  
  return `# Auto-generated redirects from plan IDs to slugs
# DO NOT EDIT MANUALLY - run 'npm run build' to regenerate

${redirects}
`;
}

// ── COPY ASSETS ───────────────────────────────────────────────────────────────
function copyAssets(assets) {
  log('Copying assets to dist...');
  
  // CSS with hash
  const criticalHash = hash(assets.criticalCss);
  const mainHash = hash(assets.mainCss);
  
  write(join(DIST, 'css', `critical.${criticalHash}.css`), assets.criticalCss);
  write(join(DIST, 'css', `main.${mainHash}.css`), assets.mainCss);
  success(`CSS: critical.${criticalHash}.css, main.${mainHash}.css`);
  
  // JS with hash
  const filtersHash = hash(assets.filtersJs);
  const galleryHash = hash(assets.galleryJs);
  const turboNavHash = hash(assets.turboNavJs);
  const analyticsHash = hash(assets.analyticsJs);
  
  write(join(DIST, 'js', `filters.${filtersHash}.js`), assets.filtersJs);
  write(join(DIST, 'js', `gallery.${galleryHash}.js`), assets.galleryJs);
  write(join(DIST, 'js', `turbo-nav.${turboNavHash}.js`), assets.turboNavJs);
  write(join(DIST, 'js', `analytics.${analyticsHash}.js`), assets.analyticsJs);
  success(`JS: filters.${filtersHash}.js, gallery.${galleryHash}.js, turbo-nav.${turboNavHash}.js, analytics.${analyticsHash}.js`);
  
  // Fonts (copy as-is, no hash for cache busting via query params)
  const fontsDir = join(ASSETS, 'fonts');
  if (existsSync(fontsDir)) {
    cpSync(fontsDir, join(DIST, 'fonts'), { recursive: true });
    success('Fonts copied');
  }
  
  // Store hash manifest for template updates
  const manifest = { criticalHash, mainHash, filtersHash, galleryHash, turboNavHash, analyticsHash };
  write(join(DIST, 'asset-manifest.json'), JSON.stringify(manifest));
  
  return manifest;
}

// ── MAIN BUILD ────────────────────────────────────────────────────────────────
async function build() {
  log('Starting WooPlans Shop v2 build...');
  const start = Date.now();
  
  try {
    // 1. Load or fetch plans
    const plans = await loadOrFetchPlans();
    
    // 2. Load templates and assets
    const templates = loadTemplates();
    const assets = loadAssets();
    
    // 3. Copy static files first
    log('Copying static files...');
    
    // Copy admin.html and analytics.html
    if (existsSync(join(ROOT, 'admin.html'))) {
      cpSync(join(ROOT, 'admin.html'), join(DIST, 'admin.html'));
      success('admin.html copied');
    }
    if (existsSync(join(ROOT, 'analytics.html'))) {
      cpSync(join(ROOT, 'analytics.html'), join(DIST, 'analytics.html'));
      success('analytics.html copied');
    }
    
    // Copy sw.js
    if (existsSync(join(ROOT, 'sw.js'))) {
      cpSync(join(ROOT, 'sw.js'), join(DIST, 'sw.js'));
      success('sw.js copied');
    }
    
    // Copy _headers and _redirects if they exist
    if (existsSync(join(ROOT, '_headers'))) {
      cpSync(join(ROOT, '_headers'), join(DIST, '_headers'));
    }
    
    // 4. Copy assets and get hash manifest
    const assetManifest = copyAssets(assets);
    
    // Update asset references in templates
    const mainCssPath = `/css/main.${assetManifest.mainHash}.css`;
    const criticalCssPath = `/css/critical.${assetManifest.criticalHash}.css`;
    const filtersJsPath = `/js/filters.${assetManifest.filtersHash}.js`;
    const galleryJsPath = `/js/gallery.${assetManifest.galleryHash}.js`;
    const turboNavJsPath = `/js/turbo-nav.${assetManifest.turboNavHash}.js`;
    const analyticsJsPath = `/js/analytics.${assetManifest.analyticsHash}.js`;
    
    // Replace asset placeholders in base template
    templates.base = templates.base
      .replace('{{mainCssPath}}', mainCssPath)
      .replace('{{filtersJsPath}}', filtersJsPath)
      .replace('{{galleryJsPath}}', galleryJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath)
      .replace('{{criticalCssPath}}', criticalCssPath);
    
    // Update home template to use correct JS paths
    templates.home = templates.home
      .replace('{{filtersJsPath}}', filtersJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath);
    
    // Update plan template
    templates.plan = templates.plan
      .replace('{{galleryJsPath}}', galleryJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath);
    
    // 5. Generate homepage
    log('Generating homepage...');
    const homeHtml = generateHomePage(templates, plans, assets);
    write(join(DIST, 'index.html'), homeHtml);
    success('Generated index.html');
    
    // 6. Generate category pages
    log('Generating category pages...');
    const villasHtml = generateCategoryPage(templates, 'villa', plans, assets);
    write(join(DIST, 'plans', 'villas', 'index.html'), villasHtml);
    success('Generated /plans/villas/index.html');
    
    const duplexHtml = generateCategoryPage(templates, 'duplex', plans, assets);
    write(join(DIST, 'plans', 'duplex', 'index.html'), duplexHtml);
    success('Generated /plans/duplex/index.html');
    
    // 7. Generate individual plan pages
    log(`Generating ${plans.length} plan pages...`);
    for (const plan of plans) {
      const planDir = join(DIST, 'plans', plan.slug);
      const planHtml = generatePlanPage(templates, plan, plans, assets);
      write(join(planDir, 'index.html'), planHtml);
    }
    success(`Generated ${plans.length} plan pages`);
    
    // 8. Generate sitemap
    log('Generating sitemap...');
    write(join(DIST, 'sitemap.xml'), generateSitemap(plans));
    success('Generated sitemap.xml');
    
    // 9. Generate robots.txt
    write(join(DIST, 'robots.txt'), generateRobotsTxt());
    success('Generated robots.txt');
    
    // 10. Generate redirects
    write(join(DIST, '_redirects'), generateRedirects(plans));
    success('Generated _redirects');
    
    // 11. Generate 404
    write(join(DIST, '404.html'), generate404(templates, assets));
    success('Generated 404.html');
    
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`Build complete in ${elapsed}s!`);
    log(`Output: ${DIST}`);
    
  } catch (err) {
    error(`Build failed: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  }
}

// ── RUN ──────────────────────────────────────────────────────────────────────
build();

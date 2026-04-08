/**
 * WooPlans Shop v2 — Static Site Generator
 * Build command: npm run build
 * Fetch plans: npm run fetch-plans
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, statSync } from 'fs';
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

function extractShortId(title) {
  const match = title.match(/([vd]\s*[-]?\s*\d+(?:[- ]\d+)*)/i);
  if (match) return match[1].replace(/\s+/g, '-').toLowerCase();
  return slugify(title).split('-').slice(0, 3).join('-');
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
    price: parseInt(String(p.priceBasic || '14900').replace(/\s/g, '')) || 14900,
    estimateCost: p.cost || '',
    images: p.images || [],
    features: p.features || [],
    typeName: p.type === 'villa' ? 'Villa' : 'Duplex',
    typeNameLower: p.type === 'villa' ? 'villa' : 'maison',
  }));

  log('Fetched ' + plans.length + ' plans');
  return plans;
}

function transformPlan(p) {
  return {
    id: p.id,
    planId: p.id,
    slug: extractShortId(p.title),
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
    rating: parseFloat(p.rating) || 4.8,
    reviews: parseInt(p.reviews) || 0,
    pdfBasicUrl: p.pdf_basic_url || '',
    chariowBasicId: p.chariow_basic_id || '',
    chariowProductId: p.type === 'villa' ? 'prd_n770b0' : 'prd_krnnh9',
    status: p.status,
    createdAt: p.created_at,
    typeName: p.type === 'villa' ? 'Villa' : 'Duplex',
    typeNameLower: p.type === 'villa' ? 'villa' : 'maison',
  };
}

async function loadOrFetchPlans() {
  const plansFile = join(DATA, 'plans.json');
  
  if (existsSync(plansFile)) {
    const stat = statSync(plansFile);
    const age = Date.now() - stat.mtimeMs;
    const maxAge = 24 * 60 * 60 * 1000;
    
    if (age < maxAge) {
      info('Using cached plans.json (' + Math.round(age / 60000) + ' min old)');
      const rawPlans = readJson(plansFile);
      return rawPlans.map(transformPlan);
    }
  }
  
  if (process.argv.includes('--fetch') || !existsSync(plansFile)) {
    const plans = await fetchPlansFromSupabase();
    write(plansFile, JSON.stringify(plans, null, 2));
    success('Saved ' + plans.length + ' plans to data/plans.json');
    return plans.map(transformPlan);
  }
  
  const rawPlans = readJson(plansFile);
  return rawPlans.map(transformPlan);
}

function loadTemplates() {
  log('Loading templates...');
  return {
    base: read(join(TEMPLATES, 'base.html')),
    home: read(join(TEMPLATES, 'home.html')),
    plan: read(join(TEMPLATES, 'plan-v2.html')),
    category: read(join(TEMPLATES, 'category.html')),
    plans: read(join(TEMPLATES, 'plans.html')),
    '404': read(join(TEMPLATES, '404.html')),
    merci: read(join(TEMPLATES, 'merci.html'))
  };
}

function loadAssets() {
  return {
    criticalCss: read(join(ASSETS, 'css', 'critical.css')),
    mainCss: read(join(ASSETS, 'css', 'main.css')),
    planV2Css: read(join(ASSETS, 'css', 'plan-v2.css')),
    filtersJs: read(join(ASSETS, 'js', 'filters.js')),
    galleryJs: read(join(ASSETS, 'js', 'gallery.js')),
    turboNavJs: read(join(ASSETS, 'js', 'turbo-nav.js')),
    analyticsJs: read(join(ASSETS, 'js', 'analytics.js')),
    checkoutJs: read(join(ASSETS, 'js', 'checkout.js'))
  };
}

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
    priceDisplay: p.price.toLocaleString('fr-FR') + ' FCFA'
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
        '@id': CFG.siteUrl + '/#website',
        url: CFG.siteUrl,
        name: 'WooPlans',
        description: 'Plans de maison premium conçus pour l\'Afrique',
        potentialAction: {
          '@type': 'SearchAction',
          target: CFG.siteUrl + '/?s={search_term_string}',
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'Organization',
        '@id': CFG.siteUrl + '/#organization',
        name: 'WooPlans',
        url: CFG.siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: CFG.siteUrl + '/logo.png'
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
  // Similar plans for the new inline format
  const similarPlans = allPlans
    .filter(p => p.type === plan.type && p.id !== plan.id)
    .slice(0, 2)
    .map(p => ({
      slug: p.slug,
      title: p.title,
      type: p.type,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      surface: p.surface,
      price: p.price.toLocaleString('fr-FR'),
      firstImage: p.images[0] || ''
    }));

  // Masonry gallery items
  const masonryItems = plan.images.map((img, i) =>
    `<div class="masonry-item" onclick="openLightbox(${i})"><img src="${img}" alt="${plan.title} - Image ${i + 1}" loading="${i < 4 ? 'eager' : 'lazy'}"></div>`
  ).join('');

  // Lightbox images array for JS
  const lightboxImages = plan.images.map(img => `"${img}"`).join(',');

  // Similar plans inline format
  const similarPlansInline = similarPlans.map(p => `
    <a href="/plans/${p.slug}/" class="similar-card">
      <div class="similar-card-image">
        <img src="${p.firstImage}" alt="${p.title}" loading="lazy">
        <span class="plan-badge">${p.type === 'villa' ? 'Villa' : 'Duplex'}</span>
      </div>
      <div class="similar-card-content">
        <h3 class="similar-card-title">${p.title}</h3>
        <p class="similar-card-specs">${p.type === 'villa' ? 'Villa' : 'Duplex'} · ${p.surface} m² · ${p.rooms} chambres · ${p.bathrooms} salles de bain</p>
        <div class="similar-card-footer">
          <div class="similar-card-price">
            <span>À PARTIR DE</span>
            ${p.price} FCFA
          </div>
          <span class="similar-card-cta">VOIR →</span>
        </div>
      </div>
    </a>
  `).join('');

  // Default rooms list if features not provided
  const defaultRooms = ['Salon', 'Salle à manger', `${plan.rooms} chambres`, `${plan.bathrooms} salles de bain`, 'Garage 1 place', 'Toilettes visiteur'];
  const roomsList = (plan.features && plan.features.length > 0
    ? plan.features
    : defaultRooms
  ).map(r => `<li>${r}</li>`).join('');

  // PDF preview (use first image or a placeholder)
  const pdfPreviewUrl = plan.images[0] || '';

  // Images count for lightbox
  const imagesCount = plan.images.length;

  const breadcrumbs = [
    { name: 'Accueil', url: '/' },
    { name: plan.type === 'villa' ? 'Villas' : 'Duplex', url: `/plans/${plan.type === 'villa' ? 'villas' : 'duplex'}/` },
    { name: plan.title, url: `/plans/${plan.slug}/` }
  ];

  // FAQ structured data for SEO
  const faqData = [
    {
      '@type': 'Question',
      name: 'Que faire si le plan ne correspond pas à mon terrain ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Un architecte vous accompagne sur WhatsApp pour adapter le plan selon vos besoins.'
      }
    },
    {
      '@type': 'Question',
      name: 'Que contient exactement le fichier que je télécharge ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Vous recevez un PDF avec le plan de distribution, les dimensions, le devis détaillé et les rendus 3D.'
      }
    },
    {
      '@type': 'Question',
      name: 'Le plan est-il conforme aux normes de construction ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, tous nos plans sont conçus par des architectes et respectent les normes en vigueur en Afrique francophone.'
      }
    },
    {
      '@type': 'Question',
      name: 'Comment je reçois le plan après avoir payé ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Le fichier est envoyé instantanément par email et WhatsApp après confirmation du paiement.'
      }
    }
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
          url: `${CFG.siteUrl}/plans/${plan.slug}/`,
          seller: {
            '@type': 'Organization',
            name: 'WooPlans'
          }
        },
        brand: { '@type': 'Brand', name: 'WooPlans' },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: plan.rating,
          reviewCount: plan.reviews
        },
        sku: plan.planId,
        mpn: plan.id
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: b.url.startsWith('http') ? b.url : CFG.siteUrl + b.url
        }))
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqData
      }
    ]
  });

  const planData = {
    title: `${plan.title} — Plan et Devis | WooPlans`,
    description: `Téléchargez le plan ${plan.title} (${plan.surface}m², ${plan.rooms} chambres). Plan détaillé + estimation coûts construction. Conçu pour l'Afrique.`,
    ogTitle: `${plan.title} — Plan et Devis`,
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
      masonryItems,
      lightboxImages,
      imagesCount,
      priceDisplay: plan.price.toLocaleString('fr-FR'),
      similarPlansInline,
      roomsList,
      pdfPreviewUrl,
      firstImage: plan.images[0] || ''
    }),
    criticalCss: assets.criticalCss + assets.planV2Css,
    bodyClass: 'plan-page'
  };

  return render(templates.base, planData);
}

function generatePlansPage(templates, plans, assets) {
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

  const intro = 'Parcourez notre catalogue complet de plans de maisons conçus pour l\'Afrique. Villas plain-pied et duplex contemporains, tous avec estimation des coûts de construction.';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Tous les Plans de Maisons — WooPlans',
    description: intro,
    url: `${CFG.siteUrl}/plans/`
  });

  const plansData = {
    title: 'Plans de Maisons Modernes — WooPlans | Catalogue Complet',
    description: intro,
    ogTitle: 'Tous les Plans de Maisons — WooPlans',
    ogDescription: intro,
    ogUrl: `${CFG.siteUrl}/plans/`,
    ogType: 'website',
    ogImage: plans[0]?.images[0] || '',
    canonical: `${CFG.siteUrl}/plans/`,
    jsonLd,
    content: render(templates.plans, {
      intro,
      items: plansItems,
      totalPlans: plans.length
    }),
    criticalCss: assets.criticalCss,
    bodyClass: 'catalog-all'
  };

  return render(templates.base, plansData);
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

function generateMerciPage(templates, plans, assets) {
  const plansJson = JSON.stringify(plans.map(p => ({
    slug: p.slug,
    title: p.title,
    type: p.type,
    surface: p.surface,
    rooms: p.rooms,
    price: p.price,
    pdfBasicUrl: p.pdfBasicUrl
  })));
  
  const data = {
    title: 'Merci pour votre commande — WooPlans',
    description: 'Votre commande a été confirmée. Téléchargez votre plan de maison WooPlans.',
    ogTitle: 'Merci pour votre commande — WooPlans',
    ogDescription: 'Votre commande a été confirmée. Téléchargez votre plan de maison WooPlans.',
    ogUrl: CFG.siteUrl + '/merci/',
    ogType: 'website',
    ogImage: '',
    canonical: CFG.siteUrl + '/merci/',
    jsonLd: '{}',
    content: templates.merci,
    plansJson,
    criticalCss: assets.criticalCss,
    bodyClass: 'merci-page'
  };
  return render(templates.base, data);
}

// ── GENERATE SITE MAP ─────────────────────────────────────────────────────────
function generateSitemap(plans) {
  const urls = [
    { loc: CFG.siteUrl + '/', priority: '1.0', changefreq: 'daily' },
    { loc: CFG.siteUrl + '/plans/', priority: '0.8', changefreq: 'daily' },
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
  const planV2Hash = hash(assets.planV2Css);

  write(join(DIST, 'css', `critical.${criticalHash}.css`), assets.criticalCss);
  write(join(DIST, 'css', `main.${mainHash}.css`), assets.mainCss);
  write(join(DIST, 'css', `plan-v2.${planV2Hash}.css`), assets.planV2Css);
  success(`CSS: critical.${criticalHash}.css, main.${mainHash}.css, plan-v2.${planV2Hash}.css`);

  // JS with hash
  const filtersHash = hash(assets.filtersJs);
  const galleryHash = hash(assets.galleryJs);
  const turboNavHash = hash(assets.turboNavJs);
  const analyticsHash = hash(assets.analyticsJs);
  const checkoutHash = hash(assets.checkoutJs);

  write(join(DIST, 'js', `filters.${filtersHash}.js`), assets.filtersJs);
  write(join(DIST, 'js', `gallery.${galleryHash}.js`), assets.galleryJs);
  write(join(DIST, 'js', `turbo-nav.${turboNavHash}.js`), assets.turboNavJs);
  write(join(DIST, 'js', `analytics.${analyticsHash}.js`), assets.analyticsJs);
  write(join(DIST, 'js', `checkout.${checkoutHash}.js`), assets.checkoutJs);
  success(`JS: filters.${filtersHash}.js, gallery.${galleryHash}.js, turbo-nav.${turboNavHash}.js, analytics.${analyticsHash}.js, checkout.${checkoutHash}.js`);
  
  // Fonts (copy as-is, no hash for cache busting via query params)
  const fontsDir = join(ASSETS, 'fonts');
  if (existsSync(fontsDir)) {
    cpSync(fontsDir, join(DIST, 'fonts'), { recursive: true });
    success('Fonts copied');
  }
  
  // Store hash manifest for template updates
  const manifest = { criticalHash, mainHash, planV2Hash, filtersHash, galleryHash, turboNavHash, analyticsHash, checkoutHash };
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
    const planV2CssPath = `/css/plan-v2.${assetManifest.planV2Hash}.css`;
    const filtersJsPath = `/js/filters.${assetManifest.filtersHash}.js`;
    const galleryJsPath = `/js/gallery.${assetManifest.galleryHash}.js`;
    const turboNavJsPath = `/js/turbo-nav.${assetManifest.turboNavHash}.js`;
    const analyticsJsPath = `/js/analytics.${assetManifest.analyticsHash}.js`;
    const checkoutJsPath = `/js/checkout.${assetManifest.checkoutHash}.js`;

    // Replace asset placeholders in base template
    templates.base = templates.base
      .replace('{{mainCssPath}}', mainCssPath)
      .replace('{{filtersJsPath}}', filtersJsPath)
      .replace('{{galleryJsPath}}', galleryJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath)
      .replace('{{checkoutJsPath}}', checkoutJsPath)
      .replace('{{criticalCssPath}}', criticalCssPath)
      .replace('{{planV2CssPath}}', planV2CssPath);

    // Update home template to use correct JS paths
    templates.home = templates.home
      .replace('{{filtersJsPath}}', filtersJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath);

    // Update plan template
    templates.plan = templates.plan
      .replace('{{galleryJsPath}}', galleryJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath)
      .replace('{{checkoutJsPath}}', checkoutJsPath)
      .replace('{{planV2CssPath}}', planV2CssPath);
    
    // Update plans template
    templates.plans = templates.plans
      .replace('{{filtersJsPath}}', filtersJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath);
    
    // Update category template
    templates.category = templates.category
      .replace('{{filtersJsPath}}', filtersJsPath);
    
    // Update merci template
    templates.merci = templates.merci
      .replace('{{mainCssPath}}', mainCssPath)
      .replace('{{analyticsJsPath}}', analyticsJsPath)
      .replace('{{turboNavJsPath}}', turboNavJsPath);
    
    // 5. Generate homepage
    log('Generating homepage...');
    const homeHtml = generateHomePage(templates, plans, assets);
    write(join(DIST, 'index.html'), homeHtml);
    success('Generated index.html');
    
    // 5b. Generate /plans/ page
    log('Generating /plans/ page...');
    const plansHtml = generatePlansPage(templates, plans, assets);
    write(join(DIST, 'plans', 'index.html'), plansHtml);
    success('Generated /plans/index.html');
    
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
    
    // 12. Generate merci page
    write(join(DIST, 'merci.html'), generateMerciPage(templates, plans, assets));
    success('Generated merci.html');
    
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

import fs from 'node:fs';
import path from 'node:path';

const CANONICAL_ORIGIN = 'https://автосиликон.рф';
const DEFAULT_DIRECTUS_URL = 'https://автосиликон.рф/directus';
const DIRECTUS_URL = (process.env.VITE_DIRECTUS_URL || DEFAULT_DIRECTUS_URL).replace(/\/$/, '');
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'sitemap.xml');

const STATIC_PATHS = [
  '/',
  '/catalog',
  '/articles',
  '/about',
  '/contacts',
  '/info/delivery',
  '/info/payment',
  '/policy',
];

const slugify = (rawName, id) => {
  const source = `${rawName ?? ''}`.toString().trim().toLowerCase();
  const normalized = source
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return `${id}-${normalized || 'product'}`;
};

const fetchProductSlugs = async () => {
  if (process.env.SKIP_REMOTE_SITEMAP === '1') return [];
  try {
    const url = new URL(`${DIRECTUS_URL}/items/Products`);
    url.searchParams.set('fields[]', 'slug');
    url.searchParams.set('fields[]', 'name');
    url.searchParams.set('fields[]', 'id');
    url.searchParams.set('limit', '500');

    const response = await fetch(url.toString());
    const json = await response.json();
    if (!response.ok || !json?.data) {
      console.warn('[sitemap] Failed to fetch products:', response.status, response.statusText);
      return [];
    }

    return json.data
      .map((item) => {
        if (typeof item.slug === 'string' && item.slug.trim()) return item.slug.trim();
        return slugify(item.name, item.id);
      })
      .filter(Boolean);
  } catch (error) {
    console.warn('[sitemap] Unable to fetch product slugs, using static pages only.', error);
    return [];
  }
};

const formatUrlTag = ({ loc, priority, lastmod }) => {
  const sanitizedLoc = loc.replace(/(?<!:)\/{2,}/g, '/');
  return [
    '  <url>',
    `    <loc>${sanitizedLoc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildSitemapXml = (entries) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(formatUrlTag),
    '</urlset>',
  ].join('\n');

const main = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const productSlugs = await fetchProductSlugs();
  const entries = [
    ...STATIC_PATHS.map((pathname) => ({
      loc: `${CANONICAL_ORIGIN}${pathname}`,
      priority: pathname === '/' ? '1.0' : '0.8',
      lastmod: today,
    })),
    ...productSlugs.map((slug) => ({
      loc: `${CANONICAL_ORIGIN}/catalog/${slug}`,
      priority: '0.7',
      lastmod: today,
    })),
  ];

  const xml = buildSitemapXml(entries);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
  console.log(`[sitemap] Generated ${OUTPUT_PATH} with ${entries.length} URLs`);
};

main().catch((error) => {
  console.error('[sitemap] Unexpected error', error);
  process.exitCode = 1;
});

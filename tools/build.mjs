// CoolFanSG static site generator. No dependencies. Node 18+.
// Usage: node tools/build.mjs      -> writes the finished site to ./dist
// Domain comes from (in order): SITE_URL env, data/site.json "domain", CF_PAGES_URL (Cloudflare preview).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../content/guides.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
const product = JSON.parse(fs.readFileSync(path.join(root, 'data/products.json'), 'utf8'))[0];

// ---------- domain ----------
let domain = (process.env.SITE_URL || site.domain || process.env.CF_PAGES_URL || '').trim().replace(/\/+$/, '');
if (!domain) { console.error('ERROR: no domain. Set "domain" in data/site.json (e.g. https://coolfan.sg).'); process.exit(1); }
if (!/^https?:\/\//.test(domain)) domain = 'https://' + domain;
const isPagesDev = /\.pages\.dev$/.test(new URL(domain).hostname);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => domain + p;
const AFF = product.affiliateUrl;
const bySlug = Object.fromEntries(guides.map((g) => [g.slug, g]));
const gUrl = (slug) => `/guides/${slug}/`;
const longDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (n) => 'S$' + Number(n).toFixed(2);
const errors = [];

function inline(s) {
  return s.replace(/\{\{g:([a-z0-9-]+)\}\}/g, (_, slug) => {
    if (!bySlug[slug]) { errors.push('Unknown guide reference: ' + slug); return slug; }
    return `<a href="${gUrl(slug)}">${esc(bySlug[slug].title)}</a>`;
  }).replace(/\{\{home\}\}/g, '<a href="/">featured product page</a>')
    .replace(/\{\{disclosure\}\}/g, '<a href="/affiliate-disclosure/">affiliate disclosure</a>');
}

const affLink = (text, cls = 'button red') =>
  `<a class="${cls}" href="${AFF}" target="_blank" rel="sponsored nofollow noopener">${text}</a>`;

// ---------- layout ----------
function head({ title, desc, path: p, jsonld = [], noindex = false, type = 'website' }) {
  const full = title.length + site.siteName.length + 3 > 62 ? title : `${title} | ${site.siteName}`;
  const url = abs(p);
  return `<!doctype html>
<html lang="${site.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en-SG" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta name="geo.region" content="SG">
<meta name="theme-color" content="#111827">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="${site.siteName}">
<meta property="og:locale" content="en_SG">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs('/assets/og-image.jpg')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/styles.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="top">Independent Singapore buying guides. Some links are affiliate links and may earn us a commission. <a href="/affiliate-disclosure/">Details</a></div>
<header class="header">
<a class="logo" href="/">CoolFan<b>SG</b></a>
<nav class="nav" aria-label="Main"><a href="/#product">Product</a><a href="/guides/">Guides</a><a href="/#faq">FAQ</a><a href="/about/">About</a></nav>
${affLink('Check deal')}
</header>
`;
}
const foot = () => `<footer class="footer"><div class="container">
<strong>${site.siteName}</strong>
<p>Independent Singapore cooling fan information. We are not the seller. Prices, coupons and availability on AliExpress can change, so always verify at checkout.</p>
<nav aria-label="Footer"><a href="/guides/">Guides</a><a href="/about/">About</a><a href="/affiliate-disclosure/">Affiliate disclosure</a><a href="/privacy/">Privacy</a></nav>
<div class="copyright">&copy; ${new Date(site.dateModified).getUTCFullYear()} ${site.siteName}. AliExpress is a trademark of its owner; this site is not affiliated with or endorsed by AliExpress.</div>
</div></footer>
<script src="/assets/site.js" defer></script>
</body></html>
`;

const crumbsLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: abs(it[1]) })),
});
const orgLd = { '@type': 'Organization', '@id': abs('/#org'), name: site.siteName, url: abs('/'), logo: abs('/assets/apple-touch-icon.png') };
const websiteLd = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: site.siteName, inLanguage: site.locale, publisher: { '@id': abs('/#org') } };

const files = new Map(); // path -> content
const pages = []; // sitemap entries
const put = (p, c) => files.set(p, c);
function addPage(urlPath, html, lastmod = site.dateModified, inSitemap = true) {
  put(urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '') + 'index.html', html);
  if (inSitemap) pages.push({ url: urlPath, lastmod });
}

const card = (g) => `<article class="card"><span class="tag">GUIDE</span><h3><a href="${gUrl(g.slug)}">${esc(g.title)}</a></h3><p>${esc(g.description)}</p></article>`;

// ---------- home ----------
{
  const p = product;
  const productLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description,
    image: [abs(p.image)], sku: p.id, category: 'Cooling Fans',
    offers: { '@type': 'Offer', url: abs('/'), priceCurrency: p.currency, price: p.price.toFixed(2) },
  };
  const faq = [
    ['Is the fan 12V DC?', 'Yes. The listing describes a 12V DC fan supplied with an AC power cord and a speed controller.'],
    ['What size is it?', '250mm / 25cm diameter, listed as a 250 × 30mm fan body.'],
    ['Will the plug fit a Singapore socket?', 'Not necessarily. Singapore uses the three-pin Type G plug at 230V. The listing photo shows a flat two-pin plug. Choose a variant that suits Singapore or confirm with the seller before ordering. See our power and plug guide.'],
    ['Which AC option should I choose for Singapore?', 'Singapore mains is 230V, 50Hz. The listing shows 110V, 115V, 220V and 230V options. A 220V or 230V option is the one to consider. Do not use a 110V/115V unit on Singapore mains.'],
    [`Is ${money(p.price)} guaranteed?`, `No. It is a price we saw on ${longDate(p.priceCheckedAt)}. Marketplace prices, coupons, shipping and taxes can change.`],
    ['Have you tested this fan?', 'No. This is an independent buying guide based on the listing information, not a hands-on test. We tell you what to check, and we do not claim performance figures the listing does not give.'],
  ];
  const html = head({
    title: '250mm 12V DC Cooling Fan in Singapore',
    desc: 'Singapore buyer guide to a 250mm 12V DC cooling fan with speed controller: specs, plug and voltage checks for Singapore, FAQs and the current AliExpress deal.',
    path: '/', jsonld: [{ '@context': 'https://schema.org', '@graph': [websiteLd, orgLd] }, productLd],
  }) + `<main id="main">
<section class="hero"><div class="container">
<span class="eyebrow">Featured product &middot; Singapore</span>
<h1>250mm 12V DC Cooling Fan for Singapore Buyers</h1>
<p>An independent look at a 25cm DC cooling fan with adjustable speed control: what the listing says, what it leaves out, and what to check for Singapore power and plugs before you order.</p>
<div class="actions">${affLink('View current AliExpress deal &rarr;')}<a class="button light" href="/guides/">Browse buying guides</a></div>
</div></section>

<section id="product" class="section"><div class="container product">
<div class="product-image"><img src="${p.image}" srcset="${p.image600} 600w, ${p.image} 1000w" sizes="(max-width:820px) 90vw, 560px" width="1000" height="1000" alt="250mm 12V DC cooling fan with black guard, DC lead and mains-powered speed controller unit" fetchpriority="high"></div>
<div>
<span class="kicker">Product snapshot</span>
<h2>${esc(p.shortName)}</h2>
<p class="muted">25cm / 250mm &middot; 12V DC &middot; 250 &times; 30mm &middot; adjustable speed controller</p>
<div class="rating"><span class="stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span><strong>${p.rating}</strong><span>from ${p.reviewCount} reviews</span><span aria-hidden="true">&middot;</span><span>${p.sold} sold</span></div>
<p class="meta">${esc(p.ratingNote)}, ${longDate(p.priceCheckedAt)}. A small number of reviews is an early signal only.</p>
<div class="deal"><div class="price">${money(p.price)}</div><p class="meta">Price seen on ${longDate(p.priceCheckedAt)}. Not guaranteed.</p><strong>Coupon shown with listing: ${esc(p.coupon)}</strong><br><small>Eligibility and the final checkout price are decided by AliExpress. Verify before paying.</small></div>
${affLink('Check price &amp; options &rarr;')}
</div></div></section>

<section class="section alt"><div class="container">
<div class="notice"><h3>Singapore check before you order</h3>
<p><strong>Plug:</strong> Singapore sockets are Type G (three-pin). The product photo shows a flat two-pin plug, which does not fit. Pick a plug option that suits Singapore or confirm with the seller.</p>
<p><strong>Voltage:</strong> Singapore mains is 230V, 50Hz. Choose the 220V/230V option, never the 110V/115V one.</p>
<p>Full explanation: ${inline('{{g:can-you-use-a-250mm-dc-fan-in-singapore}}')}.</p>
<figure><img src="/assets/diagram-singapore-power-check.svg" alt="Diagram of the power chain from a Singapore 230V Type G socket through plug and power unit to a 12V DC fan, with what to accept and what to avoid" width="800" height="420" loading="lazy"></figure></div>
<div class="grid two">
<div class="card"><h3>Could suit you if</h3><ul><li>You want gentle, wide airflow in a workshop, hobby room or large enclosure.</li><li>You like to adjust speed for quieter running.</li><li>You are comfortable selecting the correct plug and voltage variant.</li></ul></div>
<div class="card"><h3>Think twice if</h3><ul><li>You need a certified, locally supported product with local warranty.</li><li>You need published airflow, current or noise figures. The listing gives none.</li><li>You plan to pull air through a dense filter or duct.</li></ul></div>
</div></div></section>

<section class="section"><div class="container">
<span class="kicker">Specifications</span><h2>Product details</h2>
<table class="specs"><tbody>${p.specs.map((s) => `<tr><th scope="row">${esc(s[0])}</th><td>${esc(s[1])}</td></tr>`).join('')}</tbody></table>
<h3>What the listing does not tell you</h3>
<ul><li>Airflow (CFM or m&sup3;/h) and static pressure</li><li>Current draw and the power unit's output rating</li><li>Noise level and bearing type</li><li>Whether the power unit carries a Singapore-recognised safety mark</li></ul>
<p class="muted">If any of these matter to you, ask the seller before ordering. We would rather say we do not know than guess.</p>
</div></section>

<section class="section alt"><div class="container">
<span class="kicker">Guides</span><h2>Cooling fan guides for Singapore</h2>
<div class="grid">${guides.slice(0, 6).map(card).join('')}</div>
<p><a class="button dark" href="/guides/">See all ${guides.length} guides &rarr;</a></p>
</div></section>

<section id="faq" class="section"><div class="container">
<span class="kicker">FAQ</span><h2>Singapore buyer FAQ</h2>
<div class="faq">${faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('')}</div>
</div></section>

<section class="cta-band"><div class="container"><h2>Check the live listing</h2><p>Verify today's price, variant, plug type, shipping and final checkout total.</p>${affLink('Open AliExpress &rarr;', 'button light')}</div></section>
</main>` + foot();
  addPage('/', html);
}

// ---------- guides ----------
for (const g of guides) {
  const urlPath = gUrl(g.slug);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description,
    image: [abs('/assets/og-image.jpg')], inLanguage: site.locale,
    datePublished: g.published || site.datePublished, dateModified: g.updated || site.dateModified,
    author: { '@type': 'Organization', name: site.siteName, url: abs('/about/') },
    publisher: { '@id': abs('/#org'), '@type': 'Organization', name: site.siteName, logo: { '@type': 'ImageObject', url: abs('/assets/apple-touch-icon.png') } },
    mainEntityOfPage: abs(urlPath),
  };
  const figHtml = (f) => `<figure><img src="${f.src}" alt="${esc(f.alt)}" width="${f.w}" height="${f.h}" loading="lazy"><figcaption>${esc(f.caption)}</figcaption></figure>`;
  const body = g.blocks.map((b, i) =>
    (b.h2 ? `<h2>${esc(b.h2)}</h2>` : '') +
    (b.p || []).map((t) => `<p>${inline(t)}</p>`).join('') +
    (b.ul ? `<ul>${b.ul.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : '') +
    (i === 0 && g.fig ? figHtml(g.fig) : '')).join('\n');
  const rel = (g.related || []).map((s) => bySlug[s]).filter(Boolean);
  g.related?.forEach((s) => { if (!bySlug[s]) errors.push(`${g.slug}: unknown related ${s}`); });
  const html = head({
    title: g.title, desc: g.description, path: urlPath, type: 'article',
    jsonld: [ld, crumbsLd([['Home', '/'], ['Guides', '/guides/'], [g.title, urlPath]])],
  }) + `<main id="main" class="page"><div class="container">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/guides/">Guides</a> &rsaquo; ${esc(g.title)}</nav>
<span class="eyebrow">Singapore buying guide</span>
<h1>${esc(g.title)}</h1>
<p class="meta">Updated ${longDate(g.updated || site.dateModified)} &middot; Independent guide by ${site.siteName}. Not a hands-on test.</p>
<article class="prose">
${body}
<div class="deal"><strong>Featured product:</strong> ${esc(product.shortName)}, ${money(product.price)} when we checked on ${longDate(product.priceCheckedAt)}. <a href="/">Read the product page</a> or ${affLink('view the AliExpress listing &rarr;', 'button red')}</div>
</article>
<section aria-labelledby="more"><h2 id="more">Related guides</h2><div class="grid">${rel.map(card).join('')}</div></section>
</div></main>` + foot();
  addPage(urlPath, html, g.updated || site.dateModified);
}

// ---------- guides index ----------
addPage('/guides/', head({
  title: 'Cooling Fan Guides for Singapore',
  desc: 'Independent Singapore cooling fan guides: 250mm and 12V DC fans, plug and voltage checks, speed control, workshop, grow tent and equipment airflow.',
  path: '/guides/', jsonld: [crumbsLd([['Home', '/'], ['Guides', '/guides/']])],
}) + `<main id="main"><section class="hero"><div class="container">
<span class="eyebrow">Topic guides</span><h1>Cooling fan guides for Singapore shoppers</h1>
<p>Size, voltage, plugs, speed control, installation and use cases, explained before you buy.</p>
<div class="search"><label for="siteSearch" class="sr">Search guides</label><input id="siteSearch" type="search" placeholder="Search guides, e.g. plug, 250mm, speed" autocomplete="off"></div>
<div id="searchResults" aria-live="polite"></div>
</div></section>
<section class="section"><div class="container"><div class="grid">${guides.map(card).join('')}</div></div></section></main>` + foot());

// ---------- trust pages ----------
const simple = (p, title, desc, h1, bodyHtml) => addPage(p, head({ title, desc, path: p, jsonld: [crumbsLd([['Home', '/'], [h1, p]])] }) +
  `<main id="main" class="page"><div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; ${esc(h1)}</nav><h1>${esc(h1)}</h1><div class="prose">${bodyHtml}</div></div></main>` + foot());

simple('/about/', 'About CoolFanSG', 'Who runs CoolFanSG, how the guides are researched and how the site earns money.', 'About CoolFanSG', `
<p>${site.siteName} is an independent information site for people in Singapore who are researching cooling fans, especially larger 12V DC fans for workshops, tents and equipment.</p>
<h2>How we work</h2>
<p>We write buying guides from listing information, published specifications and general engineering and safety knowledge. We do not currently run hands-on tests, and we say so on each guide. Where a listing does not state a figure, such as airflow or current draw, we say it is not stated rather than guess.</p>
<h2>How the site earns money</h2>
<p>Links to AliExpress are affiliate links. If you buy through them we may earn a commission at no extra cost to you. Read the full <a href="/affiliate-disclosure/">affiliate disclosure</a>.</p>
<h2>Corrections</h2>
<p>Prices, coupons and listings change quickly. If you find something out of date or wrong, ${site.contactEmail ? `email <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>` : 'let us know through the contact details of this site'} and we will review it.</p>`);

simple('/affiliate-disclosure/', 'Affiliate Disclosure', 'How CoolFanSG earns commission from affiliate links and what that means for you.', 'Affiliate disclosure', `
<p>${site.siteName} participates in affiliate programmes. Links marked as sponsored, including the "Check deal" buttons, take you to AliExpress. If you make a purchase after clicking, we may earn a commission. It does not change the price you pay.</p>
<h2>What this means</h2>
<ul><li>We are not the seller and do not hold stock, take payment or handle shipping, returns or warranty. Those are between you and the seller on AliExpress.</li><li>Prices, coupons, ratings and availability shown on this site are snapshots. The date is shown next to them. Always verify at checkout.</li><li>Commissions do not buy a better write-up. We try to flag limits and unknowns about the product honestly.</li></ul>`);

simple('/privacy/', 'Privacy Policy', 'What data CoolFanSG collects, which is very little, and what third parties may do when you click an affiliate link.', 'Privacy policy', `
<p>This site does not ask you to create an account, does not run advertising scripts and does not set its own cookies. The guide search runs in your browser.</p>
<h2>Hosting</h2>
<p>The site is delivered through Cloudflare, which processes technical data such as IP address and request details to serve pages and protect against abuse.</p>
<h2>Affiliate links</h2>
<p>When you click a link to AliExpress, AliExpress and its affiliate partners may set cookies and process data under their own policies so a purchase can be attributed to us. We do not control this.</p>
<h2>Changes</h2>
<p>If we add analytics or other tools, we will update this page first. This page is general information, not legal advice.</p>`);

// ---------- 404 ----------
put('404.html', head({ title: 'Page not found', desc: 'This page could not be found.', path: '/404.html', noindex: true }) +
  `<main id="main" class="page"><div class="container"><h1>Page not found</h1><p class="lead">That page does not exist. Try the <a href="/">product page</a> or browse the <a href="/guides/">guides</a>.</p></div></main>` + foot());

// ---------- sitemap, robots, search, headers ----------
put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map((e) => `<url><loc>${abs(e.url)}</loc><lastmod>${e.lastmod}</lastmod></url>`).join('\n') + `\n</urlset>\n`);
put('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
put('search-index.json', JSON.stringify([
  { title: product.shortName, description: product.description, keywords: ['250mm cooling fan Singapore', '12V cooling fan Singapore'], url: '/' },
  ...guides.map((g) => ({ title: g.title, description: g.description, keywords: g.keywords || [], url: gUrl(g.slug) })),
]));
put('_headers', `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
/assets/*
  Cache-Control: public, max-age=604800
${isPagesDev ? '' : `https://:project.pages.dev/*
  X-Robots-Tag: noindex
`}`);

// ---------- validation ----------
const hrefs = new Set(files.keys());
const exists = (u) => {
  const clean = u.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return true;
  if (hrefs.has(clean.replace(/^\//, ''))) return true;
  if (clean.endsWith('/') && hrefs.has(clean.replace(/^\//, '') + 'index.html')) return true;
  return fs.existsSync(path.join(root, clean)) || fs.existsSync(path.join(root, 'public', clean));
};
const titles = new Map();
for (const [f, c] of files) {
  if (!f.endsWith('.html')) continue;
  for (const m of c.matchAll(/(?:href|src)="(\/[^"]*)"/g)) if (!exists(m[1])) errors.push(`${f}: broken link ${m[1]}`);
  const t = c.match(/<title>(.*?)<\/title>/)[1];
  if (titles.has(t)) errors.push(`duplicate title: ${t}`); titles.set(t, f);
  const d = c.match(/<meta name="description" content="([^"]*)"/)[1];
  if (d.length > 175) errors.push(`${f}: description ${d.length} chars`);
  if ((c.match(/<h1[ >]/g) || []).length !== 1) errors.push(`${f}: needs exactly one h1`);
  if (/YOUR-DOMAIN/.test(c)) errors.push(`${f}: placeholder domain`);
}
if (errors.length) { console.error('Build failed:\n - ' + errors.join('\n - ')); process.exit(1); }

// ---------- write ----------
fs.rmSync(dist, { recursive: true, force: true });
for (const [f, c] of files) { const t = path.join(dist, f); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, c); }
fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
console.log(`OK: ${pages.length} pages, domain ${domain}${isPagesDev ? ' (pages.dev: preview only)' : ''}`);

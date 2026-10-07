# CoolFanSG V4

Situs statis (tanpa dependensi). Konten ada di `content/guides.mjs`, `data/products.json`, `data/site.json`; `tools/build.mjs` menghasilkan folder `dist/` (halaman, sitemap, robots, search index, header keamanan).

## Deploy: GitHub -> Cloudflare Pages
1. Upload seluruh isi folder ini ke repo GitHub (branch `main`).
2. Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git -> pilih repo.
3. Build command: `node tools/build.mjs` — Build output directory: `dist` — Environment variable: `NODE_VERSION` = `22`.
4. Setelah live di `xxx.pages.dev`, tambahkan Custom Domain (Pages -> Custom domains).
5. Isi `"domain"` di `data/site.json` dengan domain final (mis. `https://coolfan.sg`), commit. Semua canonical, sitemap, dan JSON-LD otomatis ikut.
6. Isi `contactEmail` di `data/site.json` (halaman About lebih tepercaya dengan kontak).

## Google Search Console
- Tambahkan properti domain, verifikasi lewat DNS Cloudflare, submit `https://domain-anda/sitemap.xml`.
- Gunakan URL Inspection -> Request indexing untuk halaman utama.
- Sinyal Singapura: `lang="en-SG"`, hreflang en-SG, konten spesifik Singapura (230V, colokan Type G, GST). Domain `.sg` membantu tetapi tidak wajib.

## Sebelum go-live
- Ganti foto produk dengan foto sendiri/izin penjual: foto saat ini memuat ikon play, colokan US, dan mungkin hak cipta pihak lain.
- Perbarui harga di `data/products.json` (`price`, `priceCheckedAt`) lalu halaman rebuild otomatis.
- Peringkat #1 tidak bisa dijamin; situs baru butuh waktu dan backlink.

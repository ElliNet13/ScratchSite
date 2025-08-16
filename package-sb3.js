const fs = require('fs/promises');
const path = require('path');
const TurboWarpPackager = require('@turbowarp/packager');

const BASE_URL = 'https://scratch.ellinet13.com';

async function findFiles(dir, ext) {
  let results = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of list) {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(await findFiles(res, ext));
    } else if (dirent.isFile() && res.endsWith(ext)) {
      results.push(res);
    }
  }
  return results;
}

// Package SB3 using TurboWarp
async function packageSB3File(filePath) {
  console.log(`📦 Packaging SB3: ${filePath}`);

  const data = await fs.readFile(filePath);
  const loadedProject = await TurboWarpPackager.loadProject(data);

  const packager = new TurboWarpPackager.Packager();
  packager.project = loadedProject;

  const autostartCode = await fs.readFile(
    path.resolve(__dirname, 'autostart.js'),
    'utf8'
  );
  packager.options.custom.js = autostartCode;
  packager.options.environment = 'html';
  packager.options.highQualityPen = true;

  const result = await packager.package();

  if (!result || !result.data) {
    throw new Error('TurboWarp packager returned empty result or missing data');
  }

  const baseName = path.basename(filePath, '.sb3');
  const outputPath = path.resolve('./dist', `${baseName}.html`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, result.data);

  console.log(`✅ Saved: ${outputPath}`);
  return `${baseName}.html`;
}

// Copy all files from publix to dist
async function copyPublix() {
  const srcDir = path.resolve('./publix');
  const destDir = path.resolve('./dist');

  async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
        console.log(`📄 Copied: ${destPath}`);
      }
    }
  }

  await copyDir(srcDir, destDir);
}

// Robots and sitemap
async function createRobotsTxt(pages) {
  const projectPaths = pages
    .map(page => `/${page.replace(/\.html$/, '')}`)
    .filter(p => p !== '/index');

  let content = `User-agent: *\nAllow: /\nDisallow: /index.html\nDisallow: /index\nDisallow: /*\n\n`;
  for (const p of projectPaths) content += `Allow: ${p}\n`;

  const robotsPath = path.resolve('./dist', 'robots.txt');
  await fs.writeFile(robotsPath, content, 'utf8');
  console.log(`✅ Created robots.txt at ${robotsPath}`);
}

async function createSitemapXml(pages) {
  const projectPaths = pages
    .map(page => page.replace(/\.html$/, ''))
    .filter(p => p !== 'index');

  const urls = [`${BASE_URL}/`].concat(projectPaths.map(p => `${BASE_URL}/${p}`));

  const sitemapEntries = urls.map(url => `
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>`;

  const sitemapPath = path.resolve('./dist', 'sitemap.xml');
  await fs.writeFile(sitemapPath, sitemapContent, 'utf8');
  console.log(`✅ Created sitemap.xml at ${sitemapPath}`);
}

(async () => {
  const projectsDir = path.resolve('./projects');

  console.log(`🔍 Searching for .sb3 files in ${projectsDir}`);

  const sb3Files = await findFiles(projectsDir, '.sb3');

  if (sb3Files.length === 0) {
    console.error('❌ No .sb3 files found.');
    process.exit(1);
  }

  const generatedPages = [];

  try {
    for (const file of sb3Files) generatedPages.push(await packageSB3File(file));

    await copyPublix(); // copy all publix contents to dist
    await createRobotsTxt(generatedPages);
    await createSitemapXml(generatedPages);

    console.log('🎉 All packaging complete!');
  } catch (err) {
    console.error('❌ Packaging failed:', err);
    process.exit(1);
  }
})();

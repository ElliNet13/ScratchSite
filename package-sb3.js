const fs = require('fs/promises');  
const path = require('path');  
const Packager = require('@turbowarp/packager');  

const BASE_URL = 'https://scratch.ellinet13.com';  // change if needed

async function findSB3Files(dir) {  
  let results = [];  
  const list = await fs.readdir(dir, { withFileTypes: true });  
  for (const dirent of list) {  
    const res = path.resolve(dir, dirent.name);  
    if (dirent.isDirectory()) {  
      results = results.concat(await findSB3Files(res));  
    } else if (dirent.isFile() && res.endsWith('.sb3')) {  
      results.push(res);  
    }  
  }  
  return results;  
}  

async function packageSB3File(filePath) {  
  console.log(`📦 Packaging: ${filePath}`);  
  
  const data = await fs.readFile(filePath);  
  const loadedProject = await Packager.loadProject(data);  
  
  const packager = new Packager.Packager();  
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
    throw new Error('Packager returned empty result or missing data');  
  }  
  
  const baseName = path.basename(filePath, '.sb3');  
  const outputPath = path.resolve('./dist', `${baseName}.html`);  
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });  
  await fs.writeFile(outputPath, result.data);  
  
  console.log(`✅ Saved: ${outputPath}`);  
  
  return `${baseName}.html`; // return generated html filename
}  

async function createRobotsTxt(pages) {
  const projectPaths = pages
    .map(page => `/${page.replace(/\.html$/, '')}`)
    .filter(p => p !== '/index'); // exclude /index because disallowed explicitly

  let content = `User-agent: *\n`;
  content += `Allow: /\n`;
  content += `Disallow: /index.html\n`;
  content += `Disallow: /index\n`;
  content += `Disallow: /*\n\n`;

  for (const p of projectPaths) {
    content += `Allow: ${p}\n`;
  }

  const robotsPath = path.resolve('./dist', 'robots.txt');
  await fs.writeFile(robotsPath, content, 'utf8');
  console.log(`✅ Created robots.txt at ${robotsPath}`);
}

async function createSitemapXml(pages) {
  // sitemap urls: root + all projects except index
  const projectPaths = pages
    .map(page => page.replace(/\.html$/, ''))
    .filter(p => p !== 'index');

  const urls = [`${BASE_URL}/`].concat(
    projectPaths.map(p => `${BASE_URL}/${p}`)
  );

  const sitemapEntries = urls.map(url => `
  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset 
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${sitemapEntries}
</urlset>`;

  const sitemapPath = path.resolve('./dist', 'sitemap.xml');
  await fs.writeFile(sitemapPath, sitemapContent, 'utf8');
  console.log(`✅ Created sitemap.xml at ${sitemapPath}`);
}

(async () => {  
  const sb3Dir = path.resolve('./sb3');  
  console.log(`🔍 Searching for .sb3 files in ${sb3Dir}`);  
  
  const sb3Files = await findSB3Files(sb3Dir);  
  
  if (sb3Files.length === 0) {  
    console.error('❌ No .sb3 files found.');  
    process.exit(1);  
  }  
  
  console.log(`✅ Found ${sb3Files.length} .sb3 file(s):`);  
  for (const file of sb3Files) console.log(` - ${file}`);  
  
  try {  
    const generatedPages = [];  
    for (const file of sb3Files) {  
      const page = await packageSB3File(file);  
      generatedPages.push(page);  
    }  
    await createRobotsTxt(generatedPages);  
    await createSitemapXml(generatedPages);
    console.log('🎉 All packaging complete!');  
  } catch (err) {  
    console.error('❌ Packaging failed:', err);  
    process.exit(1);  
  }  
})();

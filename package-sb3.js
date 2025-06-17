const fs = require('fs/promises');
const path = require('path');
const Packager = require('@turbowarp/packager');

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

  // Inject extra HTML into the output file
  await injectHTML(outputPath);
}

async function injectHTML(filePath) {
  console.log(`💉 Injecting extra HTML into ${filePath}`);

  const injection = `
<link href="https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css" rel="stylesheet" />
<script type="module">
	import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

	createChat({
		webhookUrl: 'https://n8n.ellinet13.com/webhook/b7b7846d-034a-456c-94ca-00a3507b2e14/chat'
	});
</script>`;

  let content = await fs.readFile(filePath, 'utf8');

  // Inject before </body>
  if (content.includes('</body>')) {
    content = content.replace('</body>', `${injection}\n</body>`);
    await fs.writeFile(filePath, content, 'utf8');
    console.log('✅ Injection complete!');
  } else {
    console.warn('⚠️ No </body> tag found in output HTML.');
  }
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
    for (const file of sb3Files) {
      await packageSB3File(file);
    }
    console.log('🎉 All packaging and injection complete!');
  } catch (err) {
    console.error('❌ Packaging failed:', err);
    process.exit(1);
  }
})();

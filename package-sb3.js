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

  packager.options.environment = 'html';
  packager.options.stageSize = 'dynamic';
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
    console.log('🎉 All packaging complete!');
  } catch (err) {
    console.error('❌ Packaging failed:', err);
    process.exit(1);
  }
})();

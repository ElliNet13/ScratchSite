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

  packager.options.environment = 'html';       // package as HTML file
  packager.options.stage = 'dynamicResize';    // stage option

  const result = await packager.package();

  if (!result || !result.data) {
    throw new Error('Packager returned empty result');
  }

  // Output folder: ./dist/{basename}
  const baseName = path.basename(filePath, '.sb3');
  const outputFolder = path.resolve('./dist', baseName);

  await fs.mkdir(outputFolder, { recursive: true });

  // Write index.html inside output folder
  const htmlPath = path.join(outputFolder, 'index.html');
  await fs.writeFile(htmlPath, result.data);

  console.log(`✅ Packaged to ${htmlPath}`);
}

(async () => {
  const sb3Dir = path.resolve('./sb3');
  console.log(`🔍 Searching for .sb3 files in ${sb3Dir}`);

  const sb3Files = await findSB3Files(sb3Dir);

  if (sb3Files.length === 0) {
    console.log('❌ No .sb3 files found.');
    process.exit(1);
  }

  console.log(`✅ Found ${sb3Files.length} .sb3 file(s):`);
  for (const file of sb3Files) {
    console.log(` - ${file}`);
  }

  try {
    for (const file of sb3Files) {
      await packageSB3File(file);
    }
    console.log('🎉 All packaging complete!');
  } catch (err) {
    console.error('❌ Error during packaging:', err);
    process.exit(1);
  }
})();

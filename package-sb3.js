const Packager = require('@turbowarp/packager');
const fs = require('fs/promises');
const path = require('path');
const JSZip = require('jszip');

async function findSB3Files(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findSB3Files(res));
    } else if (entry.isFile() && res.endsWith('.sb3')) {
      results.push(res);
    }
  }
  return results;
}

async function unpackZip(zipBuffer, outputFolder) {
  const zip = await JSZip.loadAsync(zipBuffer);

  await Promise.all(
    Object.keys(zip.files).map(async (filename) => {
      const file = zip.files[filename];
      const destPath = path.join(outputFolder, filename);

      if (file.dir) {
        await fs.mkdir(destPath, { recursive: true });
      } else {
        const content = await file.async('nodebuffer');
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, content);
      }
    })
  );
}

async function packageSB3File(filePath, distRoot) {
  console.log(`Packaging ${filePath}`);

  const data = await fs.readFile(filePath);
  const loadedProject = await Packager.loadProject(data);

  const packager = new Packager.Packager();
  packager.project = loadedProject;
  packager.options.environment = 'zip';
  packager.options.stage = 'dynamicResize';

  const zipBuffer = await packager.package();

  const baseName = path.basename(filePath, '.sb3');
  const outputFolder = path.join(distRoot, baseName);
  await fs.mkdir(outputFolder, { recursive: true });

  await unpackZip(zipBuffer, outputFolder);
  console.log(`Extracted to: ${outputFolder}`);
}

(async () => {
  const sb3Root = path.resolve('./sb3');
  const distRoot = path.resolve('./dist');

  const sb3Files = await findSB3Files(sb3Root);

  if (sb3Files.length === 0) {
    console.log('No .sb3 files found in ./sb3.');
    return;
  }

  for (const file of sb3Files) {
    try {
      await packageSB3File(file, distRoot);
    } catch (e) {
      console.error(`Failed to package ${file}:`, e);
    }
  }
})();

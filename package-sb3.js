// package-sb3.js
const Packager = require('@turbowarp/packager');
const fs = require('fs/promises');
const path = require('path');
const JSZip = require('jszip');

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

async function unpackZip(zipBuffer, outputFolder, htmlFileName) {
  const zip = await JSZip.loadAsync(zipBuffer);

  // Extract all files
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

  // Rename index.html or project.html to desired HTML filename
  // The packager usually outputs 'index.html' in the zip root
  const indexPath = path.join(outputFolder, 'index.html');
  const newHtmlPath = path.join(outputFolder, htmlFileName);
  try {
    await fs.rename(indexPath, newHtmlPath);
  } catch (e) {
    console.warn(`Warning: Could not rename index.html for ${outputFolder}`, e);
  }
}

async function packageSB3File(filePath) {
  console.log(`Packaging ${filePath}`);

  const data = await fs.readFile(filePath);
  const loadedProject = await Packager.loadProject(data);

  const packager = new Packager.Packager();
  packager.project = loadedProject;
  packager.options.environment = 'zip'; // Zip for website
  packager.options.stage = 'dynamicResize'; // dynamic resize stage

  const zipBuffer = await packager.package();

  // Output folder named after sb3 file (no extension)
  const baseName = path.basename(filePath, '.sb3');
  const outputFolder = path.join(path.dirname(filePath), baseName);

  await fs.mkdir(outputFolder, { recursive: true });

  // Unpack zip with renamed HTML file
  await unpackZip(zipBuffer, outputFolder, `${baseName}.html`);

  console.log(`Packaged to folder: ${outputFolder}`);
}

(async () => {
  const startDir = process.cwd();
  const sb3Files = await findSB3Files(startDir);

  if (sb3Files.length === 0) {
    console.log('No .sb3 files found.');
    return;
  }

  for (const file of sb3Files) {
    try {
      await packageSB3File(file);
    } catch (e) {
      console.error(`Failed to package ${file}:`, e);
    }
  }
})();

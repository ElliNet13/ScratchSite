const Packager = require('@turbowarp/packager');
const fs = require('fs/promises');
const path = require('path');
const JSZip = require('jszip');

// Recursively find all .sb3 files under a directory
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

// Unpack a ZIP buffer to the output folder
async function unpackZip(zipBuffer, outputFolder) {
  try {
    const zip = await JSZip.loadAsync(zipBuffer);
    const files = Object.keys(zip.files);
    console.log(`Unpacking ${files.length} files to ${outputFolder}`);

    if (files.length === 0) {
      console.warn('⚠️ ZIP appears to be empty!');
    }

    await Promise.all(
      files.map(async (filename) => {
        const file = zip.files[filename];
        const destPath = path.join(outputFolder, filename);
        console.log(` → Writing: ${destPath}`);

        if (file.dir) {
          await fs.mkdir(destPath, { recursive: true });
        } else {
          const content = await file.async('nodebuffer');
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.writeFile(destPath, content);
        }
      })
    );
  } catch (err) {
    console.error('❌ Failed to unpack ZIP:', err);
  }
}

// Package one .sb3 file and extract its contents
async function packageSB3File(filePath, distRoot) {
  console.log(`\n📦 Packaging: ${filePath}`);

  try {
    const data = await fs.readFile(filePath);
    const loadedProject = await Packager.loadProject(data);

    const packager = new Packager.Packager();
    packager.project = loadedProject;
    packager.options.environment = 'zip';
    packager.options.stage = 'dynamicResize';

    const zipBuffer = await packager.package();

    console.log(`🧩 ZIP buffer size: ${zipBuffer.length} bytes`);

    const baseName = path.basename(filePath, '.sb3');
    const outputFolder = path.join(distRoot, baseName);
    await fs.mkdir(outputFolder, { recursive: true });

    await unpackZip(zipBuffer, outputFolder);

    console.log(`✅ Done: Extracted to ${outputFolder}`);
  } catch (e) {
    console.error(`❌ Error processing ${filePath}:`, e);
  }
}

// Main script entry point
(async () => {
  const sb3Root = path.resolve('./sb3');
  const distRoot = path.resolve('./dist');

  console.log(`🔍 Searching for .sb3 files in ${sb3Root}`);
  const sb3Files = await findSB3Files(sb3Root);

  if (sb3Files.length === 0) {
    console.log('⚠️ No .sb3 files found.');
    return;
  }

  console.log(`✅ Found ${sb3Files.length} .sb3 file(s):`);
  sb3Files.forEach(f => console.log(' -', f));

  for (const file of sb3Files) {
    await packageSB3File(file, distRoot);
  }

  console.log('\n🎉 All packaging complete!');
})();

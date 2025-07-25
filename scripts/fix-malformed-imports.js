#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function fixMalformedImports() {
  const routeFiles = glob.sync('src/routes/**/*.ts', { cwd: process.cwd() });
  let totalChanges = 0;
  let filesChanged = 0;

  console.log(`Processing ${routeFiles.length} route files...`);

  for (const filePath of routeFiles) {
    const fullPath = path.resolve(filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changes = 0;

    // Fix malformed import: " from '../middleware/auth';" should be removed entirely
    if (content.includes(" from '../middleware/auth';")) {
      content = content.replace(/\s+from ['"]\.\.\/middleware\/auth['"];?\n?/g, '');
      changes++;
    }

    // Fix any other similar malformed imports
    if (content.includes(" from '")) {
      content = content.replace(/^\s+from ['"][^'"]+['"];?\n?/gm, '');
      changes++;
    }

    if (changes > 0) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ ${filePath}: ${changes} changes`);
      filesChanged++;
      totalChanges += changes;
    }
  }

  console.log(`\n🎯 Summary:`);
  console.log(`  Files processed: ${routeFiles.length}`);
  console.log(`  Files changed: ${filesChanged}`);
  console.log(`  Total changes: ${totalChanges}`);
  
  return { filesChanged, totalChanges };
}

// Run the script
fixMalformedImports()
  .then(({ filesChanged, totalChanges }) => {
    console.log(`\n✨ Malformed import fix completed!`);
  })
  .catch(console.error);
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function fixMergedImports() {
  const routeFiles = glob.sync('src/routes/**/*.ts', { cwd: process.cwd() });
  let totalChanges = 0;
  let filesChanged = 0;

  console.log(`Processing ${routeFiles.length} route files...`);

  for (const filePath of routeFiles) {
    const fullPath = path.resolve(filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changes = 0;

    // Fix merged import statements like: 
    // "import { FastifyRequest, FastifyReply } from 'fastify';import { FastifyInstance } from 'fastify';"
    // Should become:
    // "import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';"
    
    // Pattern 1: Merge two fastify imports
    const mergedFastifyRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]fastify['"];import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]fastify['"];/g;
    content = content.replace(mergedFastifyRegex, (match, first, second) => {
      changes++;
      // Combine the imports and remove duplicates
      const firstItems = first.split(',').map(s => s.trim());
      const secondItems = second.split(',').map(s => s.trim());
      const allItems = [...new Set([...firstItems, ...secondItems])];
      return `import { ${allItems.join(', ')} } from 'fastify';`;
    });

    // Pattern 2: Fix any remaining merged imports (;import pattern)
    const generalMergedRegex = /(['"];)import\s/g;
    content = content.replace(generalMergedRegex, (match, semicolonQuote) => {
      changes++;
      return semicolonQuote + '\nimport ';
    });

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
fixMergedImports()
  .then(({ filesChanged, totalChanges }) => {
    console.log(`\n✨ Merged import fix completed!`);
  })
  .catch(console.error);
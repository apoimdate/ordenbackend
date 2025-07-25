#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function finalTypeFix() {
  const routeFiles = glob.sync('src/routes/**/*.ts', { cwd: process.cwd() });
  let totalChanges = 0;
  let filesChanged = 0;

  console.log(`Processing ${routeFiles.length} route files...`);

  for (const filePath of routeFiles) {
    const fullPath = path.resolve(filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    let changes = 0;

    // 1. Ensure FastifyRequest and FastifyReply are imported if used but not imported
    const hasFastifyRequestUsage = content.includes('request: FastifyRequest');
    const hasFastifyReplyUsage = content.includes('reply: FastifyReply');
    const hasFastifyImport = content.includes("from 'fastify'");
    
    if ((hasFastifyRequestUsage || hasFastifyReplyUsage) && hasFastifyImport) {
      // Check if FastifyRequest/FastifyReply are already in the import
      const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]fastify['"];/g;
      const importMatch = importRegex.exec(content);
      
      if (importMatch) {
        const importedItems = importMatch[1].split(',').map(s => s.trim());
        const needsRequest = hasFastifyRequestUsage && !importedItems.some(item => item.includes('FastifyRequest'));
        const needsReply = hasFastifyReplyUsage && !importedItems.some(item => item.includes('FastifyReply'));
        
        if (needsRequest || needsReply) {
          let newImports = [...importedItems];
          if (needsRequest) newImports.push('FastifyRequest');
          if (needsReply) newImports.push('FastifyReply');
          
          const newImportLine = `import { ${newImports.join(', ')} } from 'fastify';`;
          content = content.replace(importMatch[0], newImportLine);
          changes++;
        }
      }
    }

    // 2. Remove AuthenticatedRequest import from auth.middleware since we're using FastifyRequest
    if (content.includes('authenticate, AuthenticatedRequest')) {
      content = content.replace('authenticate, AuthenticatedRequest', 'authenticate');
      changes++;
    }

    // 3. Remove standalone AuthenticatedRequest imports
    if (content.includes('import { AuthenticatedRequest }')) {
      content = content.replace(/import\s*\{\s*AuthenticatedRequest\s*\}\s*from[^;]+;?\n?/g, '');
      changes++;
    }

    // 4. Convert any remaining AuthenticatedRequest parameters to FastifyRequest
    content = content.replace(/async \(request: AuthenticatedRequest,/g, 'async (request: FastifyRequest,');
    content = content.replace(/\(request: AuthenticatedRequest\)/g, '(request: FastifyRequest)');
    if (content.includes('AuthenticatedRequest')) {
      changes++;
    }

    // 5. Remove @ts-expect-error comments about FastifyRequest not found
    const beforeTsExpectError = content;
    content = content.replace(/\s*\/\/ @ts-expect-error TS\(2304\): Cannot find name 'FastifyRequest'\.\n?/g, '');
    if (content !== beforeTsExpectError) {
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
finalTypeFix()
  .then(({ filesChanged, totalChanges }) => {
    console.log(`\n✨ Final type fix completed!`);
    console.log(`   Expected to resolve import/type errors`);
  })
  .catch(console.error);
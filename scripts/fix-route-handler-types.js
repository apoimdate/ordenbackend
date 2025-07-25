#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route files
const routeFiles = glob.sync('src/routes/**/*.routes.ts');

console.log(`Found ${routeFiles.length} route files to process`);

let totalFixed = 0;

routeFiles.forEach(file => {
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(file, 'utf8');
  let fixCount = 0;
  
  // Pattern 1: Fix route handlers with schema/preHandler in separate object
  // Match patterns like:
  // fastify.post('/path', { schema/preHandler }, async (request: FastifyRequest<...>, reply) => {
  const routePattern = /fastify\.(get|post|put|delete|patch)\s*(<[^>]+>)?\s*\(\s*'([^']+)',\s*\{([^}]+)\}\s*,\s*async\s*\(request:\s*FastifyRequest(<[^>]+>)?,\s*reply:\s*FastifyReply\)\s*=>\s*\{/g;
  
  content = content.replace(routePattern, (match, method, genericType1, path, options, genericType2) => {
    fixCount++;
    // Reconstruct with handler inside the options object
    return `fastify.${method}${genericType1 || ''}('${path}', {
${options}},
    handler: async (request: FastifyRequest${genericType2 || ''}, reply: FastifyReply) => {`;
  });
  
  // Pattern 2: Fix closing braces - add extra closing for the options object
  // After each route handler closing, we need to close the handler property
  const handlerEndPattern = /(\s*}\s*\)\s*;)(\s*\/\/|$|\s*\/\*|\s*fastify\.)/gm;
  
  if (fixCount > 0) {
    let replacementCount = 0;
    content = content.replace(handlerEndPattern, (match, ending, nextContent) => {
      // Only replace as many times as we fixed handlers
      if (replacementCount < fixCount) {
        replacementCount++;
        return `  }${ending}${nextContent}`;
      }
      return match;
    });
  }
  
  // Pattern 3: Fix routes that already have handler but wrong type
  const existingHandlerPattern = /handler:\s*async\s*\(request:\s*any,\s*reply:\s*any\)\s*=>/g;
  content = content.replace(existingHandlerPattern, (match) => {
    fixCount++;
    return 'handler: async (request: FastifyRequest, reply: FastifyReply) =>';
  });
  
  // Pattern 4: Fix auth.routes.ts specific pattern where handlers use any type
  if (file.includes('auth.routes.ts')) {
    const authHandlerPattern = /,\s*async\s*\(request:\s*any,\s*reply:\s*any\)\s*=>\s*\{/g;
    content = content.replace(authHandlerPattern, (match) => {
      fixCount++;
      return `,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {`;
    });
    
    // Fix the closing braces for auth routes
    const authEndPattern = /(\s*}\s*\)\s*;)(\s*\n\s*\/\*\*)/gm;
    content = content.replace(authEndPattern, (match, ending, comment) => {
      return `  }${ending}${comment}`;
    });
  }
  
  if (fixCount > 0) {
    fs.writeFileSync(file, content);
    console.log(`  Fixed ${fixCount} route handlers`);
    totalFixed += fixCount;
  }
});

console.log(`\nTotal route handlers fixed: ${totalFixed}`);
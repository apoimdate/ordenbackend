#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route files
const routeFiles = glob.sync('src/routes/**/*.routes.ts');

console.log(`Found ${routeFiles.length} route files to fix`);

let totalFixed = 0;

routeFiles.forEach(file => {
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fixCount = 0;
  
  // Fix auth.routes.ts specific patterns where handler is incorrectly placed
  if (file.includes('auth.routes.ts')) {
    // Pattern for fixing handler placement
    const authPattern = /(\}\s*,\s*)\n\s*handler:\s*async\s*\(request:\s*FastifyRequest,\s*reply:\s*FastifyReply\)\s*=>\s*\{/g;
    content = content.replace(authPattern, (match, prefix) => {
      fixCount++;
      return '},\n    handler: async (request: FastifyRequest, reply: FastifyReply) => {';
    });
    
    // Remove extra closing braces that were added
    const extraBracePattern = /\}\s*\}\s*\}\s*\);/g;
    content = content.replace(extraBracePattern, (match) => {
      return '    }\n  });\n';
    });
  }
  
  // Fix chat.routes.ts specific patterns
  if (file.includes('chat.routes.ts')) {
    // Fix the handler placement in chat routes
    const chatPattern = /\}\s*,\s*\n\s*handler:\s*async\s*\(request:\s*FastifyRequest(<[^>]+>)?,\s*reply:\s*FastifyReply\)\s*=>\s*\{/g;
    content = content.replace(chatPattern, (match, generic) => {
      fixCount++;
      return '},\n    handler: async (request: FastifyRequest' + (generic || '') + ', reply: FastifyReply) => {';
    });
    
    // Remove duplicate closing braces
    content = content.replace(/\}\s*\}\s*\n\s*\}\);/g, '    }\n  });');
    
    // Fix broken file endings
    content = content.replace(/\n \s*No newline at end of file/g, '');
  }
  
  // Fix other route files with similar patterns
  if (file.includes('commission.routes.ts') || file.includes('pickup.routes.ts') || file.includes('customs.routes.ts')) {
    // Fix handler placement
    const routePattern = /\}\s*,\s*\n\s*handler:\s*async\s*\(request:\s*FastifyRequest(<[^>]+>)?,\s*reply:\s*FastifyReply\)\s*=>\s*\{/g;
    content = content.replace(routePattern, (match, generic) => {
      fixCount++;
      return '},\n    handler: async (request: FastifyRequest' + (generic || '') + ', reply: FastifyReply) => {';
    });
    
    // Fix closing braces
    content = content.replace(/\}\s*\}\s*\n\s*\}\);/g, '    }\n  });');
  }
  
  // Fix product-qa.routes.ts specific patterns
  if (file.includes('product-qa.routes.ts')) {
    // Fix misplaced closing braces and handler placement
    const qaPattern = /\}\s*\}\s*\n\s*\}\s*\)\s*;/g;
    content = content.replace(qaPattern, '    }\n  });');
    
    // Fix handler placement
    const handlerPattern = /\}\s*,\s*\n\s*handler:\s*async/g;
    content = content.replace(handlerPattern, '},\n    handler: async');
  }
  
  // General fix for all files - ensure proper formatting
  // Fix cases where we have }, at the end of options followed by handler
  const generalPattern = /(\w+\s*:\s*[^}]+\s*)\}\s*,\s*\n\s*handler:/g;
  content = content.replace(generalPattern, '$1},\n    handler:');
  
  // Fix double closing braces at the end of route definitions
  const doubleClosePattern = /\}\s*\}\s*\)\s*;(\s*\n\s*\/\*\*|\s*\n\s*\/\/|\s*\n\s*fastify\.)/g;
  content = content.replace(doubleClosePattern, '    }\n  });$1');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`  Fixed ${file}`);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);
const fs = require('fs');
const glob = require('glob');

// Find all route files
const routeFiles = glob.sync('src/routes/**/*.ts');

console.log(`Found ${routeFiles.length} route files`);

let totalFixes = 0;

routeFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Check if file uses FastifyRequest but doesn't import it
  if (content.includes('FastifyRequest') && !content.includes("import { FastifyRequest") && !content.includes("import {FastifyRequest")) {
    // Check if it already imports FastifyInstance
    if (content.includes("import { FastifyInstance } from 'fastify'")) {
      // Add FastifyRequest to existing import
      content = content.replace(
        "import { FastifyInstance } from 'fastify'",
        "import { FastifyInstance, FastifyRequest } from 'fastify'"
      );
    } else if (content.includes('import { FastifyInstance }')) {
      // Add FastifyRequest to existing import (different quotes)
      content = content.replace(
        /import { FastifyInstance } from ['"]fastify['"]/,
        "import { FastifyInstance, FastifyRequest } from 'fastify'"
      );
    } else {
      // Add new import at the beginning
      content = "import { FastifyRequest } from 'fastify';\n" + content;
    }
    
    fs.writeFileSync(file, content);
    totalFixes++;
    console.log(`Fixed imports in ${file}`);
  }
});

console.log(`\nTotal files fixed: ${totalFixes}`);
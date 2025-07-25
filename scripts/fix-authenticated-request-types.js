const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route files
const routeFiles = glob.sync('src/routes/**/*.ts');

console.log(`Found ${routeFiles.length} route files`);

let totalReplacements = 0;

routeFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let replacements = 0;
  
  // Replace AuthenticatedRequest with FastifyRequest in handler signatures
  const updatedContent = content
    // Remove AuthenticatedRequest import if it exists alone
    .replace(/import\s*{\s*AuthenticatedRequest\s*}\s*from\s*['"]@middleware\/auth\.middleware['"]\s*;\s*\n/g, '')
    // Update imports that have both authenticate and AuthenticatedRequest
    .replace(/import\s*{\s*authenticate\s*,\s*AuthenticatedRequest\s*}\s*from\s*['"]@middleware\/auth\.middleware['"]/g, "import { authenticate } from '@middleware/auth.middleware'")
    // Replace handler parameters
    .replace(/\(request:\s*AuthenticatedRequest/g, (match) => {
      replacements++;
      return '(request: FastifyRequest';
    })
    .replace(/async\s+\(request:\s*AuthenticatedRequest/g, (match) => {
      replacements++;
      return 'async (request: FastifyRequest';
    });
  
  if (replacements > 0) {
    fs.writeFileSync(file, updatedContent);
    totalReplacements += replacements;
    console.log(`Fixed ${replacements} instances in ${file}`);
  }
});

console.log(`\nTotal replacements: ${totalReplacements}`);
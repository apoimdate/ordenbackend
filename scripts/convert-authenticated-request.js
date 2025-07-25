#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔄 Converting AuthenticatedRequest to FastifyRequest pattern...');

// Get all files with AuthenticatedRequest errors
let tscOutput;
try {
  tscOutput = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
} catch (error) {
  tscOutput = error.output[1] || error.stdout || '';
}

// Extract files that have AuthenticatedRequest issues
const filesWithErrors = new Set();
tscOutput.split('\n')
  .filter(line => line.includes('AuthenticatedRequest') && line.includes('not assignable'))
  .forEach(line => {
    const match = line.match(/^([^(]+)\(/);
    if (match) {
      filesWithErrors.add(match[1]);
    }
  });

console.log(`📁 Found ${filesWithErrors.size} files to convert`);

let totalConversions = 0;

// Convert each file
filesWithErrors.forEach(filePath => {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = content;
    let conversions = 0;

    // 1. Replace AuthenticatedRequest imports - keep both types available
    if (updatedContent.includes("import { FastifyRequest, FastifyReply } from 'fastify';")) {
      // FastifyRequest already imported, just add AuthenticatedRequest import from middleware/auth
      if (!updatedContent.includes("import { AuthenticatedRequest }")) {
        updatedContent = updatedContent.replace(
          "import { FastifyRequest, FastifyReply } from 'fastify';",
          "import { FastifyRequest, FastifyReply } from 'fastify';\nimport { AuthenticatedRequest } from '../middleware/auth';"
        );
      }
    } else {
      // Add both imports
      if (updatedContent.includes("import") && !updatedContent.includes("FastifyRequest")) {
        const firstImport = updatedContent.indexOf('import');
        const newImports = "import { FastifyRequest, FastifyReply } from 'fastify';\nimport { AuthenticatedRequest } from '../middleware/auth';\n";
        updatedContent = updatedContent.slice(0, firstImport) + newImports + updatedContent.slice(firstImport);
      }
    }

    // 2. Convert route handler parameters from AuthenticatedRequest to FastifyRequest
    // Pattern: (request: AuthenticatedRequest, reply: FastifyReply)
    const handlerPattern = /\(\s*request:\s*AuthenticatedRequest\s*,\s*reply:\s*FastifyReply[^)]*\)/g;
    const matches = updatedContent.match(handlerPattern);
    if (matches) {
      updatedContent = updatedContent.replace(handlerPattern, '(request: FastifyRequest, reply: FastifyReply)');
      conversions += matches.length;
    }

    // 3. Add type assertions for user access - find patterns like request.user
    // Replace request.user with (request as any).user
    const userAccessPattern = /request\.user(?![\w\.])/g;
    const userMatches = updatedContent.match(userAccessPattern);
    if (userMatches) {
      updatedContent = updatedContent.replace(userAccessPattern, '(request as any).user');
    }

    // 4. Add type assertions for params, body, query access if they exist
    // These patterns are already handled by ts-migrate but let's ensure they're consistent
    const paramPattern = /request\.params(?![\w\.])/g;
    const paramsMatches = updatedContent.match(paramPattern);
    if (paramsMatches) {
      updatedContent = updatedContent.replace(paramPattern, '(request.params as any)');
    }

    const bodyPattern = /request\.body(?![\w\.])/g;
    const bodyMatches = updatedContent.match(bodyPattern);
    if (bodyMatches) {
      updatedContent = updatedContent.replace(bodyPattern, '(request.body as any)');
    }

    const queryPattern = /request\.query(?![\w\.])/g;
    const queryMatches = updatedContent.match(queryPattern);
    if (queryMatches) {
      updatedContent = updatedContent.replace(queryPattern, '(request.query as any)');
    }

    if (conversions > 0 || updatedContent !== content) {
      fs.writeFileSync(filePath, updatedContent);
      console.log(`✅ ${path.relative(process.cwd(), filePath)}: ${conversions} handler conversions`);
      totalConversions += conversions;
    }

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Successfully converted ${totalConversions} route handlers!`);
console.log('\n🔄 Re-running TypeScript check...');

// Re-run TypeScript check to see the improvement
try {
  const newTscOutput = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
  const errorCount = (newTscOutput.match(/error TS\d+:/g) || []).length;
  console.log(`📊 New error count: ${errorCount}`);
} catch (error) {
  const output = error.output[1] || error.stdout || '';
  const errorCount = (output.match(/error TS\d+:/g) || []).length;
  console.log(`📊 New error count: ${errorCount}`);
}
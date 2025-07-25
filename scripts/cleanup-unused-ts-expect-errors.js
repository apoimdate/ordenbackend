#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get list of files with unused @ts-expect-error directives
console.log('🔍 Analyzing TypeScript errors...');
let tscOutput;
try {
  tscOutput = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
} catch (error) {
  // TypeScript compilation will exit with non-zero status when there are errors
  tscOutput = error.output[1] || error.stdout || '';
}
const unusedDirectiveErrors = tscOutput
  .split('\n')
  .filter(line => line.includes("Unused '@ts-expect-error' directive"))
  .map(line => {
    const match = line.match(/^([^(]+)\((\d+),(\d+)\):/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]) - 1, // Convert to 0-based indexing
        column: parseInt(match[3]) - 1
      };
    }
    return null;
  })
  .filter(Boolean);

console.log(`📊 Found ${unusedDirectiveErrors.length} unused @ts-expect-error directives`);

// Group by file for efficient processing
const fileGroups = unusedDirectiveErrors.reduce((acc, error) => {
  if (!acc[error.file]) {
    acc[error.file] = [];
  }
  acc[error.file].push(error);
  return acc;
}, {});

let totalRemoved = 0;

// Process each file
Object.entries(fileGroups).forEach(([filePath, errors]) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort errors by line number in descending order to avoid index shifting
    const sortedErrors = errors.sort((a, b) => b.line - a.line);
    
    let removedCount = 0;
    
    sortedErrors.forEach(error => {
      const lineIndex = error.line;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Check if this line contains only whitespace and @ts-expect-error comment
        if (line.trim().startsWith('// @ts-expect-error')) {
          lines.splice(lineIndex, 1);
          removedCount++;
        } else if (line.includes('// @ts-expect-error')) {
          // Handle inline @ts-expect-error comments
          lines[lineIndex] = line.replace(/\s*\/\/ @ts-expect-error[^\n]*/, '');
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✅ ${path.relative(process.cwd(), filePath)}: removed ${removedCount} unused directives`);
      totalRemoved += removedCount;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Successfully removed ${totalRemoved} unused @ts-expect-error directives!`);
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
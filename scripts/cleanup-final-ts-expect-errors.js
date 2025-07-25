#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function cleanupUnusedTsExpectErrors() {
  console.log('🔍 Finding unused @ts-expect-error directives...\n');
  
  // Get TypeScript errors
  let tsErrors;
  try {
    tsErrors = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
  } catch (e) {
    tsErrors = e.stdout;
  }
  
  // Find all TS2578 errors (unused @ts-expect-error)
  const unusedDirectives = [];
  const lines = tsErrors.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS2578: Unused '@ts-expect-error' directive\./);
    if (match) {
      unusedDirectives.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3])
      });
    }
  }
  
  console.log(`Found ${unusedDirectives.length} unused @ts-expect-error directives\n`);
  
  // Group by file
  const fileGroups = {};
  for (const directive of unusedDirectives) {
    if (!fileGroups[directive.file]) {
      fileGroups[directive.file] = [];
    }
    fileGroups[directive.file].push(directive.line);
  }
  
  // Process each file
  let totalRemoved = 0;
  for (const [filePath, lineNumbers] of Object.entries(fileGroups)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort line numbers in reverse order to avoid index shifting
    lineNumbers.sort((a, b) => b - a);
    
    for (const lineNum of lineNumbers) {
      // Remove the @ts-expect-error line (lineNum is 1-based)
      const lineIndex = lineNum - 1;
      if (lines[lineIndex] && lines[lineIndex].includes('@ts-expect-error')) {
        lines.splice(lineIndex, 1);
        totalRemoved++;
      }
    }
    
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ ${path.relative(process.cwd(), filePath)}: Removed ${lineNumbers.length} directives`);
  }
  
  console.log(`\n🎯 Total removed: ${totalRemoved} unused @ts-expect-error directives`);
  return totalRemoved;
}

// Run the cleanup
cleanupUnusedTsExpectErrors()
  .then(count => {
    console.log(`\n✨ Cleanup completed! Removed ${count} unused directives.`);
  })
  .catch(console.error);
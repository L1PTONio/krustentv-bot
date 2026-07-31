import fs from 'fs';
import path from 'path';
import process from 'process';
import { spawnSync } from 'child_process';

const rootDir = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'coverage', 'data', 'tmp', 'temp', 'dist', 'build']);
const filesToCheck = [];

function walk(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      walk(path.join(currentDir, entry.name));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      filesToCheck.push(path.join(currentDir, entry.name));
    }
  }
}

walk(rootDir);

const errors = [];

for (const filePath of filesToCheck) {
  const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || 'Syntax error').trim();
    errors.push(`${relativePath}: ${output}`);
  }
}

if (errors.length > 0) {
  console.error('Syntax check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Syntax check passed for ${filesToCheck.length} JavaScript files.`);

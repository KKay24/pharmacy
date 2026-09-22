const { execFileSync } = require('node:child_process');
const path = require('node:path');

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const forbiddenPattern = /(^|\/)(\.env(?:\..*)?|.*\.(?:sqlite|sqlite3|db|backup|bak|log))$/i;
const allowedFiles = new Set(['.env.example']);
const violations = trackedFiles.filter((file) => {
  const basename = path.basename(file);
  return forbiddenPattern.test(file) && !allowedFiles.has(basename);
});

if (violations.length > 0) {
  console.error('Sensitive files are tracked by Git:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('Sensitive-file check passed.');
}
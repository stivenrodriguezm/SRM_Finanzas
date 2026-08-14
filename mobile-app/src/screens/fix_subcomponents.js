const fs = require('fs');
const files = [
  'DebtDetailScreen.js',
  'PreferencesScreen.js',
  'ProfileScreen.js',
  'TransactionsScreen.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Inject into helper functions (function Name() { ... })
  content = content.replace(/(function [A-Z][a-zA-Z0-9_]*\([^)]*\)\s*\{)/g, "$1\n  const { colors } = usePreferences();\n  const styles = getStyles(colors);\n");

  // Inject into const Helper = () => { ... }
  content = content.replace(/(const [A-Z][a-zA-Z0-9_]*\s*=\s*\([^)]*\)\s*=>\s*\{)/g, "$1\n  const { colors } = usePreferences();\n  const styles = getStyles(colors);\n");

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}

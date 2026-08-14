const fs = require('fs');

const files = process.argv.slice(2);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Check if it has `const getStyles`
  if (content.includes('const getStyles')) {
    
    // Inject import if missing
    if (!content.includes("import { usePreferences } from '../context/PreferencesContext';")) {
      // add import below useAuth or axios
      content = content.replace("import { useAuth }", "import { usePreferences } from '../context/PreferencesContext';\nimport { useAuth }");
    }

    // Inject styles extraction if missing
    if (!content.includes('const styles = getStyles(')) {
      // add right after export default function X() {
      content = content.replace(/(export default function [^\(]+\(\) \{\s*)/, "$1  const { colors, isDark } = usePreferences();\n  const styles = getStyles(colors);\n");
    }

  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed', file);
}

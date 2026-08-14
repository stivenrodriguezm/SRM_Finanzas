const fs = require('fs');

const file = process.argv[2];
if (!file) process.exit(1);

let content = fs.readFileSync(file, 'utf8');

// 1. Add colors to usePreferences if missing
if (content.includes('usePreferences')) {
  // Check if it already extracts colors
  if (!content.includes('{ colors') && !content.includes('colors,')) {
    content = content.replace(/const { ([^}]+) } = usePreferences\(\);/, 'const { $1, colors, isDark } = usePreferences();\n  const styles = getStyles(colors);');
    content = content.replace(/const \{preferences\} = usePreferences\(\);/g, 'const { preferences, colors, isDark } = usePreferences();\n  const styles = getStyles(colors);');
  }
} else {
  // If it doesn't use preferences, we'll need to inject it. Let's do it manually if needed.
}

// 2. Change StyleSheet.create
if (content.includes('const styles = StyleSheet.create({')) {
  content = content.replace('const styles = StyleSheet.create({', 'const getStyles = (colors) => StyleSheet.create({');
} else if (content.includes('const styles = StyleSheet.create (')) {
  content = content.replace('const styles = StyleSheet.create (', 'const getStyles = (colors) => StyleSheet.create(');
}

// 3. Replace color hexes with theme variables in the style object
// For a safe regex replacement, we only want to replace within the getStyles block.
const styleSplit = content.split('const getStyles = (colors) => StyleSheet.create({');
if (styleSplit.length === 2) {
  let styleBlock = styleSplit[1];
  
  const colorMap = {
    "'#F5F7FA'": "colors.background",
    "'#FFFFFF'": "colors.card",
    "'#111827'": "colors.textPrimary",
    "'#1E293B'": "colors.primary",
    "'#374151'": "colors.textPrimary",
    "'#4B5563'": "colors.textSecondary",
    "'#6B7280'": "colors.textSecondary",
    "'#9CA3AF'": "colors.textMuted",
    "'#94A3B8'": "colors.textMuted",
    "'#E5E7EB'": "colors.border",
    "'#F3F4F6'": "colors.iconBg",
    "'#059669'": "colors.success",
    "'#16A34A'": "colors.successText",
    "'#DCFCE7'": "colors.successLight",
    "'#DC2626'": "colors.danger",
    "'#EF4444'": "colors.danger",
    "'#FEE2E2'": "colors.dangerLight",
    "'#FEF2F2'": "colors.dangerLight",
    "'#3B82F6'": "colors.info",
    "'#DBEAFE'": "colors.infoLight",
    "'#EFF6FF'": "colors.infoLight",
    "'#7C3AED'": "colors.purple",
    "'#F5F3FF'": "colors.purpleLight",
    "'#EDE9FE'": "colors.purpleLight",
    "'#CA8A04'": "colors.warning",
    "'#FEF08A'": "colors.warningLight",
    "'#EA580C'": "colors.warning",
    "'#FFF7ED'": "colors.warningLight",
    "'#0284C7'": "colors.info",
    "'#BAE6FD'": "colors.infoLight",
    "'rgba(255,255,255,0.08)'": "colors.transparentBg",
  };

  for (const [hex, themeVar] of Object.entries(colorMap)) {
    // Replace hex strings with the JS variable
    const regex = new RegExp(hex.replace(/([()])/g, '\\$1'), 'gi');
    styleBlock = styleBlock.replace(regex, themeVar);
  }

  content = styleSplit[0] + 'const getStyles = (colors) => StyleSheet.create({' + styleBlock;
}

fs.writeFileSync(file, content, 'utf8');
console.log('Processed', file);

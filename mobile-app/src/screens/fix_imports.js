const fs = require('fs');

const files = [
  'AddRecordScreen.js',
  'AddDebtScreen.js',
  'AddReminderScreen.js',
  'ReceivablesScreen.js',
  'ReminderDetailScreen.js'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("import { usePreferences }")) {
    // Insert after the last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, endOfLastImport) + "\nimport { usePreferences } from '../context/PreferencesContext';" + content.slice(endOfLastImport);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}

const fs = require('fs');

const screens = [
  { file: 'HomeScreen.js', key: 'home' },
  { file: 'TransactionsScreen.js', key: 'transactions' },
  { file: 'DebtsScreen.js', key: 'debts' },
  { file: 'RemindersScreen.js', key: 'reminders' },
  { file: 'ReceivablesScreen.js', key: 'receivables' },
];

for (const {file, key} of screens) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix HomeScreen initial state
  if (file === 'HomeScreen.js') {
    content = content.replace('const [isPrivate, setIsPrivate] = useState(false);', `const [isPrivate, setIsPrivate] = useState(preferences.privacy.home);`);
  }

  // Inject useEffect to sync
  const searchPattern = `const [isPrivate, setIsPrivate] = useState(preferences.privacy.${key});`;
  const replacePattern = `const [isPrivate, setIsPrivate] = useState(preferences.privacy.${key});
  
  React.useEffect(() => {
    setIsPrivate(preferences.privacy.${key});
  }, [preferences.privacy.${key}]);`;

  if (!content.includes(`[preferences.privacy.${key}]`)) {
    content = content.replace(searchPattern, replacePattern);
  }
  
  // Make sure React is imported, it already is in all files.
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed privacy sync for', file);
}

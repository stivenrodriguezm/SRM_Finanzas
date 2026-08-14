const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/TransactionsScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Add RefreshControl and useFocusEffect to imports
content = content.replace(
  "TouchableOpacity, Modal, TextInput, Switch\n} from 'react-native';",
  "TouchableOpacity, Modal, TextInput, Switch, RefreshControl\n} from 'react-native';"
);
content = content.replace(
  "import { useAuth } from '../context/AuthContext';",
  "import { useAuth } from '../context/AuthContext';\nimport { useFocusEffect } from '@react-navigation/native';"
);

// Replace useEffect with useFocusEffect
content = content.replace(
  /useEffect\(\(\) => \{\n\s*fetchTransactions\(\);\n\s*\}, \[token\]\);/,
  `const [refreshing, setRefreshing] = useState(false);
  
  useFocusEffect(
    React.useCallback(() => {
      fetchTransactions();
    }, [token])
  );
  
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [token]);`
);

// Inject refreshControl into ScrollView
content = content.replace(
  /<ScrollView\s*\n\s*showsVerticalScrollIndicator=\{false\}\n\s*contentContainerStyle=\{styles\.listContent\}\n\s*>/,
  `<ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated TransactionsScreen.js with pull-to-refresh');

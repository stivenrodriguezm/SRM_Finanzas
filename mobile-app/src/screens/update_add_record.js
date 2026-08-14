const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/AddRecordScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Replace imports
content = content.replace(
  "import { Ionicons } from '@expo/vector-icons';",
  "import { Ionicons } from '@expo/vector-icons';\nimport { useAuth } from '../context/AuthContext';\nimport axios from 'axios';\nimport { ActivityIndicator, Alert } from 'react-native';"
);

// Replace default data with empty or remove it. We'll fetch it.
const defaultDataRegex = /\/\/ Datos agrupados por naturaleza[\s\S]*?const TRANSACTION_TYPES =/m;
content = content.replace(defaultDataRegex, "const API_URL = 'http://192.168.40.21:5005/api';\n\nconst TRANSACTION_TYPES =");

// Inject inside component
const componentStartRegex = /(const initialType = route\.params\?\.initialType \|\| 'gasto';\n  const \[recordType, setRecordType\] = useState\(initialType\);)/;
const injectedState = `$1

  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  React.useEffect(() => {
    fetchAccounts();
  }, [token]);

  const fetchAccounts = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(\`\${API_URL}/accounts\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setAccounts(data);
    } catch (error) {
      console.log('Error fetching accounts', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleSave = async () => {
    if (!amount || !concept) {
      Alert.alert('Error', 'Por favor ingresa un monto y un concepto.');
      return;
    }
    
    // Validar cuenta seleccionada
    const accountSelected = recordType === 'ingreso' ? selectedDestAccount : selectedOriginAccount;
    if (!accountSelected) {
      Alert.alert('Error', 'Por favor selecciona una cuenta.');
      return;
    }

    setIsSubmitting(true);
    
    // Map 'gasto' to 'egreso' for the backend
    const backendType = recordType === 'gasto' ? 'egreso' : recordType;

    try {
      await axios.post(
        \`\${API_URL}/transactions\`,
        {
          title: concept,
          amount: Number(amount),
          type: backendType,
          account: accountSelected
        },
        {
          headers: { Authorization: \`Bearer \${token}\` }
        }
      );
      navigation.goBack();
    } catch (error) {
      console.log('Error saving transaction', error);
      Alert.alert('Error', 'No se pudo guardar la transacción.');
    } finally {
      setIsSubmitting(false);
    }
  };
`;
content = content.replace(componentStartRegex, injectedState);

// Replace handleAccountSelection
content = content.replace(
  /const handleAccountSelection = \(accountName\) => \{[\s\S]*?setAccountModalVisible\(false\);\n  \};/,
  `const handleAccountSelection = (accountId) => {
    if (modalTarget === 'origin') setSelectedOriginAccount(accountId);
    if (modalTarget === 'dest') setSelectedDestAccount(accountId);
    setAccountModalVisible(false);
  };`
);

// Update TextInput values
content = content.replace(
  /placeholder="0\.00"\n\s*keyboardType="numeric"\n\s*placeholderTextColor="#9CA3AF"\n\s*\/>/m,
  `placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
                value={amount}
                onChangeText={setAmount}
              />`
);

content = content.replace(
  /placeholder="Ej\. Salario, Cena, Pago tarjeta\.\.\."\n\s*placeholderTextColor="#9CA3AF"\n\s*\/>/m,
  `placeholder="Ej. Salario, Cena, Pago tarjeta..."
                placeholderTextColor="#9CA3AF"
                value={concept}
                onChangeText={setConcept}
              />`
);

// Update selectedAccount names in UI
const selectedNameHelper = `
  const getAccountName = (id) => {
    const acc = accounts.find(a => a._id === id);
    return acc ? acc.name : '';
  };
`;
content = content.replace('const activeType = TRANSACTION_TYPES', selectedNameHelper + '\n  const activeType = TRANSACTION_TYPES');

content = content.replace(
  /\{selectedOriginAccount \|\| '¿De dónde sale el dinero\?'\}/g,
  `{getAccountName(selectedOriginAccount) || '¿De dónde sale el dinero?'}`
);

content = content.replace(
  /\{selectedDestAccount \|\| '¿A dónde entra el dinero\?'\}/g,
  `{getAccountName(selectedDestAccount) || '¿A dónde entra el dinero?'}`
);
content = content.replace(
  /\{selectedDestAccount \|\| 'Selecciona la deuda a abonar'\}/g,
  `{getAccountName(selectedDestAccount) || 'Selecciona la deuda a abonar'}`
);

// Update Button
content = content.replace(
  /onPress=\{\(\) => navigation\.goBack\(\)\}\n\s*>\n\s*<Text style=\{styles\.saveButtonText\}>Guardar Transacción<\/Text>/,
  `onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Transacción</Text>
            )}`
);

// Update Modal Rendering
content = content.replace(
  /\{ACCOUNTS_DATA\.map\(\(section, idx\) => \([\s\S]*?<View style=\{\{ height: 20 \}\} \/>\n\s*<\/ScrollView>/m,
  `
              {isLoadingAccounts ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginTop: 20 }} />
              ) : (
                <>
                  <Text style={[styles.modalSectionTitle, { color: '#059669' }]}>Mis Cuentas</Text>
                  {accounts.map((acc, j) => (
                    <TouchableOpacity
                      key={acc._id}
                      style={styles.modalItem}
                      onPress={() => handleAccountSelection(acc._id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons
                          name={acc.isLiability ? 'card-outline' : 'cash-outline'}
                          size={20}
                          color={acc.isLiability ? '#DC2626' : '#059669'}
                          style={{ marginRight: 12 }}
                        />
                        <Text style={styles.modalItemText}>{acc.name} - $ {acc.balance}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
  `
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated AddRecordScreen.js');

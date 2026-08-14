const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/DebtDetailScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Add states
content = content.replace(
  "const [amountInput, setAmountInput] = useState('');",
  "const [amountInput, setAmountInput] = useState('');\n  const [increaseAmount, setIncreaseAmount] = useState('');\n  const [increaseConcept, setIncreaseConcept] = useState('');\n  const [isSubmitting, setIsSubmitting] = useState(false);\n  const [debtDetails, setDebtDetails] = useState(null);"
);

// Add Alert
content = content.replace(
  "ScrollView, Modal, TextInput, Platform, ActivityIndicator, KeyboardAvoidingView\n} from 'react-native';",
  "ScrollView, Modal, TextInput, Platform, ActivityIndicator, KeyboardAvoidingView, Alert\n} from 'react-native';"
);

// Add useFocusEffect
content = content.replace(
  "import { useRoute, useNavigation } from '@react-navigation/native';",
  "import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';"
);

// Add fetchDebt
const fetchDebtLogic = `
  useFocusEffect(
    React.useCallback(() => {
      fetchDebt();
    }, [token])
  );

  const fetchDebt = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(\`\${API_URL}/debts\`, { headers: { Authorization: \`Bearer \${token}\` } });
      const currentDebt = data.find(d => d._id === route.params.id);
      if (currentDebt) setDebtDetails(currentDebt);
    } catch (e) {
      console.log('Error fetching debt', e);
    }
  };
`;
content = content.replace(
  "React.useEffect(() => {\n    fetchAccounts();\n  }, [token]);",
  "React.useEffect(() => {\n    fetchAccounts();\n  }, [token]);\n" + fetchDebtLogic
);

// Update handlePayment
const updatedHandlePayment = `
  const handlePayment = async () => {
    if (!amountInput || !selectedAccount) {
      Alert.alert('Error', 'Por favor ingresa un monto y selecciona una cuenta.');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(\`\${API_URL}/debts/\${route.params.id}/payment\`, {
        amount: Number(amountInput),
        accountId: selectedAccount
      }, { headers: { Authorization: \`Bearer \${token}\` } });
      
      setDecreaseModalVisible(false);
      setAmountInput('');
      fetchDebt();
      Alert.alert('Éxito', 'Abono registrado correctamente');
    } catch (e) {
      console.log('Error abonando a deuda', e);
      Alert.alert('Error', 'No se pudo registrar el abono');
    } finally {
      setIsSubmitting(false);
    }
  };
`;
content = content.replace(/const handlePayment = async \(\) => \{[\s\S]*?catch \(e\) \{[\s\S]*?\}\n  \};/, updatedHandlePayment);

// Update handleConfirmIncrease
const updatedIncrease = `
  const handleConfirmIncrease = async () => {
    if (!increaseAmount || !debtDetails) return;
    setIsSubmitting(true);
    try {
      const newTotal = debtDetails.totalAmount + Number(increaseAmount);
      const newRemaining = debtDetails.remainingAmount + Number(increaseAmount);
      await axios.put(\`\${API_URL}/debts/\${route.params.id}\`, {
        ...debtDetails,
        totalAmount: newTotal,
        remainingAmount: newRemaining
      }, { headers: { Authorization: \`Bearer \${token}\` } });
      
      setIncreaseAmount('');
      setIncreaseConcept('');
      setIncreaseModalVisible(false);
      fetchDebt();
      Alert.alert('Éxito', 'Aumento de deuda registrado correctamente');
    } catch (e) {
      console.log('Error aumentando deuda', e);
      Alert.alert('Error', 'No se pudo registrar el aumento');
    } finally {
      setIsSubmitting(false);
    }
  };
`;
content = content.replace(/const handleConfirmIncrease = \(\) => \{[\s\S]*?setIncreaseModalVisible\(false\);\n  \};/, updatedIncrease);

// Update UI to use debtDetails instead of route.params when available
content = content.replace(
  "<Text style={styles.title}>{title}</Text>",
  "<Text style={styles.title}>{debtDetails?.name || title}</Text>"
);
content = content.replace(
  "<Text style={[styles.amountValue, { color }]}>{total}</Text>",
  "<Text style={[styles.amountValue, { color }]}>{debtDetails ? \`$ \${debtDetails.remainingAmount.toLocaleString('es-CO')}\` : total}</Text>"
);

// Update decrease modal button to show loading
content = content.replace(
  /<TouchableOpacity style=\{styles\.modalBtnPrimary\} onPress=\{handlePayment\}>\n\s*<Text style=\{styles\.modalBtnPrimaryText\}>Confirmar Abono<\/Text>\n\s*<\/TouchableOpacity>/,
  `<TouchableOpacity style={styles.modalBtnPrimary} onPress={handlePayment} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Confirmar Abono</Text>}
                </TouchableOpacity>`
);

// Update increase modal button to show loading
content = content.replace(
  /<TouchableOpacity style=\{styles\.modalBtnPrimary\} onPress=\{handleConfirmIncrease\}>\n\s*<Text style=\{styles\.modalBtnPrimaryText\}>Confirmar Aumento<\/Text>\n\s*<\/TouchableOpacity>/,
  `<TouchableOpacity style={styles.modalBtnPrimary} onPress={handleConfirmIncrease} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Confirmar Aumento</Text>}
                </TouchableOpacity>`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated DebtDetailScreen.js');

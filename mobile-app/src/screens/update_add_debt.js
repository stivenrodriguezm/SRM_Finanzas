const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/AddDebtScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(
  "import { usePreferences } from '../context/PreferencesContext';",
  "import { usePreferences } from '../context/PreferencesContext';\nimport { useAuth } from '../context/AuthContext';\nimport axios from 'axios';\nimport { ActivityIndicator, Alert } from 'react-native';"
);

// State variables
const stateInject = `  const { token } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const API_URL = 'http://192.168.40.21:5005/api';

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'Por favor ingresa un nombre.');
      return;
    }
    if (!isModifyMode && !amount) {
      Alert.alert('Error', 'Por favor ingresa un monto.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Error', 'Por favor selecciona una fecha límite.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isModifyMode) {
        await axios.put(
          \`\${API_URL}/debts/\${route.params.id}\`,
          {
            name,
            type: debtType,
            dueDate: selectedDate,
            isActive,
            description
          },
          { headers: { Authorization: \`Bearer \${token}\` } }
        );
      } else {
        await axios.post(
          \`\${API_URL}/debts\`,
          {
            name,
            totalAmount: Number(amount),
            type: debtType,
            dueDate: selectedDate,
            description,
            color: debtType === 'debo' ? '#EF4444' : '#10B981',
            icon: 'person'
          },
          { headers: { Authorization: \`Bearer \${token}\` } }
        );
      }
      navigation.goBack();
    } catch (error) {
      console.log('Error saving debt', error);
      Alert.alert('Error', 'No se pudo guardar la deuda.');
    } finally {
      setIsSubmitting(false);
    }
  };`;

content = content.replace(
  "  const handleDateChange = (event, date) => {",
  stateInject + "\n\n  const handleDateChange = (event, date) => {"
);

// TextInputs
content = content.replace(
  /placeholder="Ej\. Juan Pérez, Banco\.\.\."\n\s*placeholderTextColor="#9CA3AF"\n\s*\/>/m,
  `placeholder="Ej. Juan Pérez, Banco..."
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
              />`
);

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
  /placeholder="Motivo del préstamo, condiciones\.\.\."\n\s*multiline\n\s*placeholderTextColor="#9CA3AF"\n\s*\/>/m,
  `placeholder="Motivo del préstamo, condiciones..."
                multiline
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
              />`
);

// Button
content = content.replace(
  /onPress=\{\(\) => navigation\.goBack\(\)\}\n\s*>\n\s*<Text style=\{styles\.saveButtonText\}>Guardar Registro<\/Text>/,
  `onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Registro</Text>
            )}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated AddDebtScreen.js logic');

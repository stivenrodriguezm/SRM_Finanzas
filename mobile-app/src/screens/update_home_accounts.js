const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/HomeScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Add states for account modal
const stateRegex = /(const \[isLiability, setIsLiability\] = useState\(false\);\n  const \[accountDescription, setAccountDescription\] = useState\(''\);)/;
content = content.replace(stateRegex, `$1\n  const [accountName, setAccountName] = useState('');\n  const [accountBalance, setAccountBalance] = useState('');\n  const [isSavingAccount, setIsSavingAccount] = useState(false);`);

// Update openAccountModal
const openModalRegex = /const openAccountModal = \(mode, account = null\) => \{[\s\S]*?setAccountModalVisible\(true\);\n  \};/;
content = content.replace(openModalRegex, `const openAccountModal = (mode, account = null) => {
    setModalMode(mode);
    setSelectedAccount(account);
    setAccountName(account?.name || '');
    setAccountBalance(account?.balance ? String(account.balance) : '');
    setIsLiability(account?.isLiability || false);
    setAccountDescription(account?.description || '');
    setAccountModalVisible(true);
  };`);

// Add handleSaveAccount
const handleSaveHelper = `
  const handleSaveAccount = async () => {
    if (!accountName) {
      alert('Por favor ingresa un nombre para la cuenta');
      return;
    }
    setIsSavingAccount(true);
    try {
      if (modalMode === 'add') {
        await axios.post(\`\${API_URL}/accounts\`, {
          name: accountName,
          balance: Number(accountBalance) || 0,
          isLiability,
          description: accountDescription,
          color: isLiability ? '#DC2626' : '#059669',
          icon: isLiability ? 'card' : 'wallet'
        }, { headers: { Authorization: \`Bearer \${token}\` } });
      } else {
        await axios.put(\`\${API_URL}/accounts/\${selectedAccount._id}\`, {
          name: accountName,
          balance: Number(accountBalance) || 0,
          isLiability,
          description: accountDescription
        }, { headers: { Authorization: \`Bearer \${token}\` } });
      }
      setAccountModalVisible(false);
      fetchData(); // Refresh list
    } catch (error) {
      console.log('Error saving account', error);
      alert('Hubo un error al guardar la cuenta');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    setIsSavingAccount(true);
    try {
      await axios.delete(\`\${API_URL}/accounts/\${selectedAccount._id}\`, { 
        headers: { Authorization: \`Bearer \${token}\` } 
      });
      setAccountModalVisible(false);
      fetchData();
    } catch (error) {
      console.log('Error deleting account', error);
      alert('Hubo un error al eliminar la cuenta');
    } finally {
      setIsSavingAccount(false);
    }
  };
`;
content = content.replace('/** Muestra el valor o asteriscos según modo privado */', handleSaveHelper + '\n  /** Muestra el valor o asteriscos según modo privado */');

// Update TextInputs
content = content.replace(
  /placeholder="Ej\. Mi Cuenta de Ahorros"\n\s*placeholderTextColor="#9CA3AF"\n\s*defaultValue=\{selectedAccount\?\.name \|\| ''\}/,
  `placeholder="Ej. Mi Cuenta de Ahorros"
                    placeholderTextColor="#9CA3AF"
                    value={accountName}
                    onChangeText={setAccountName}`
);

content = content.replace(
  /placeholder="0\.00"\n\s*keyboardType="numeric"\n\s*placeholderTextColor="#9CA3AF"\n\s*defaultValue=\{selectedAccount\?\.balance \|\| ''\}/,
  `placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                    value={accountBalance}
                    onChangeText={setAccountBalance}`
);

// Update Buttons
content = content.replace(
  /<TouchableOpacity style=\{styles\.saveButton\} onPress=\{\(\) => setAccountModalVisible\(false\)\}>\n\s*<Text style=\{styles\.saveButtonText\}>\n\s*\{modalMode === 'add' \? 'Crear Cuenta' : 'Guardar Cambios'\}\n\s*<\/Text>\n\s*<\/TouchableOpacity>/,
  `<TouchableOpacity style={styles.saveButton} onPress={handleSaveAccount} disabled={isSavingAccount}>
              {isSavingAccount ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {modalMode === 'add' ? 'Crear Cuenta' : 'Guardar Cambios'}
                </Text>
              )}
            </TouchableOpacity>`
);

content = content.replace(
  /<TouchableOpacity style=\{styles\.deleteButton\} onPress=\{\(\) => setAccountModalVisible\(false\)\}>\n\s*<Text style=\{styles\.deleteButtonText\}>Eliminar Cuenta<\/Text>\n\s*<\/TouchableOpacity>/,
  `<TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isSavingAccount}>
                <Text style={styles.deleteButtonText}>Eliminar Cuenta</Text>
              </TouchableOpacity>`
);

// Add ActivityIndicator to imports if missing
if (!content.includes('ActivityIndicator')) {
  content = content.replace(
    "ScrollView, Modal, TextInput, Switch, Platform, KeyboardAvoidingView",
    "ScrollView, Modal, TextInput, Switch, Platform, KeyboardAvoidingView, ActivityIndicator"
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Updated HomeScreen.js account creation logic.');

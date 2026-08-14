const fs = require('fs');
const path = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/ReceivablesScreen.js';
const debtsPath = '/Users/stiven/Desktop/Coding/Finanzas personales/mobile-app/src/screens/DebtsScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Copiamos la lógica básica de DebtsScreen.js
// 1. Imports
content = content.replace(
  "import { useNavigation } from '@react-navigation/native';",
  "import { useNavigation, useFocusEffect } from '@react-navigation/native';\nimport { useAuth } from '../context/AuthContext';\nimport axios from 'axios';\nimport SkeletonLoader from '../components/SkeletonLoader';\nimport { RefreshControl } from 'react-native';"
);

// 2. States and fetch
const stateInjection = `const navigation = useNavigation();
  const { token } = useAuth();
  const [receivables, setReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const API_URL = 'http://192.168.40.21:5005/api';

  const fetchReceivables = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(\`\${API_URL}/debts\`, {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      setReceivables(data.filter(d => d.type === 'me_deben'));
    } catch (error) {
      console.log('Error fetching receivables', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchReceivables();
    }, [token])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchReceivables();
    setRefreshing(false);
  }, [token]);

  const totalReceivable = receivables.reduce((acc, curr) => acc + curr.remainingAmount, 0);`;

content = content.replace(
  "const navigation = useNavigation();",
  stateInjection
);
content = content.replace(
  "import React from 'react';",
  "import React, { useState } from 'react';"
);

// 3. Update summary card
content = content.replace(
  "<Text style={styles.summaryAmount}>$ 170.000</Text>",
  "<Text style={styles.summaryAmount}>$ {totalReceivable.toLocaleString('es-CO')}</Text>"
);

// 4. Update the ScrollView to include RefreshControl
content = content.replace(
  "<ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>",
  `<ScrollView 
      contentContainerStyle={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
    >`
);

// 5. Replace hardcoded debts with map
const dynamicList = `        {isLoading ? (
          <View style={{ marginTop: 20 }}>
            <SkeletonLoader width="100%" height={80} borderRadius={16} />
            <View style={{ height: 12 }} />
            <SkeletonLoader width="100%" height={80} borderRadius={16} />
          </View>
        ) : receivables.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 20 }}>No tienes préstamos registrados.</Text>
        ) : (
          receivables.map(item => (
            <View key={item._id} style={styles.debtCard}>
              <View style={styles.debtHeader}>
                <View style={styles.debtTitleContainer}>
                  <View style={[styles.iconPill, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name={item.icon || 'person'} size={16} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={styles.debtName}>{item.name}</Text>
                    {item.dueDate && (
                      <Text style={styles.dueDateText}>Vence: {new Date(item.dueDate).toLocaleDateString('es-CO')}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => navigation.navigate('DebtDetail', {
                    id: item._id,
                    title: item.name,
                    total: \`$ \${item.remainingAmount.toLocaleString('es-CO')}\`,
                    color: '#16A34A',
                    icon: item.icon || 'person',
                    iconColor: '#16A34A',
                    iconBg: '#DCFCE7',
                    type: 'me_deben'
                  })}
                >
                  <Text style={styles.payButtonText}>Ver más</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.debtAmountValue}>
                $ {item.remainingAmount.toLocaleString('es-CO')}
                {item.totalAmount > item.remainingAmount && (
                  <Text style={{ fontSize: 12, color: '#6B7280' }}> (Total: $ {item.totalAmount.toLocaleString('es-CO')})</Text>
                )}
              </Text>
            </View>
          ))
        )}

        {/* ── Botón flotante para nuevo Préstamo ── */}`;

// Buscamos donde empieza el comentario de Juan y cortamos hasta el botón
content = content.replace(/\{\/\* Préstamo 1 — Juan \*\/\}[\s\S]*?\{\/\* ── Botón flotante para nuevo Préstamo ── \*\/\}/, dynamicList);

fs.writeFileSync(path, content, 'utf8');
console.log('ReceivablesScreen.js updated successfully');

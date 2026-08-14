const axios = require('axios');

async function testCreateDebt() {
  try {
    // 1. Log in to get token (using stiven@outlook.com or stiven@finanzas.app)
    // Actually, I don't know the password. Let's just create a new user to get a token, or login.
    let token = '';
    try {
      const loginRes = await axios.post('http://127.0.0.1:5005/api/auth/login', {
        email: 'stiven@finanzas.app',
        password: 'password123'
      });
      token = loginRes.data.token;
    } catch (e) {
      // Create user if not exists
      const regRes = await axios.post('http://127.0.0.1:5005/api/auth/register', {
        name: 'Stiven',
        email: 'stiven_test@finanzas.app',
        password: 'password123'
      });
      token = regRes.data.token;
    }

    console.log('Got token:', token ? 'yes' : 'no');

    // 2. Test create debt
    const debtRes = await axios.post('http://127.0.0.1:5005/api/debts', {
      name: 'Test Debt',
      totalAmount: 50000,
      type: 'debo',
      // omitting dueDate to see if it works
      color: '#EF4444',
      icon: 'person'
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log('Create debt SUCCESS:', debtRes.data);

  } catch (err) {
    console.error('Create debt ERROR:', err.response?.data || err.message);
  }
}

testCreateDebt();

async function testCreateDebt() {
  try {
    const regRes = await fetch('http://127.0.0.1:5005/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stiven', email: 'stiven_test3@finanzas.app', password: 'password123' })
    });
    const data = await regRes.json();
    let token = data.token;

    console.log('Got token:', token ? 'yes' : 'no');

    const debtRes = await fetch('http://127.0.0.1:5005/api/debts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        name: 'Test Debt',
        totalAmount: 50000,
        type: 'debo',
        color: '#EF4444',
        icon: 'person'
      })
    });
    
    const resData = await debtRes.json();
    console.log('Create debt status:', debtRes.status);
    console.log('Create debt response:', resData);

  } catch (err) {
    console.error('Create debt ERROR:', err);
  }
}

testCreateDebt();

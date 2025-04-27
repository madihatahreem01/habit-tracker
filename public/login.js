async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
  
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  
    if (res.ok) {
      window.location.href = '/app.html';
    } else {
      alert('Login failed');
    }
  }
  
  async function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
  
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  
    if (res.ok) {
      alert('Registered successfully! Now login.');
    } else {
      alert('Registration failed');
    }
  }
  
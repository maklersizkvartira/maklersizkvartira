fetch('https://maklersizkvartira-production.up.railway.app/api/v1/smart/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: "chilonzordan uy kere" })
}).then(res => res.json()).then(console.log).catch(console.error);

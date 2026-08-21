const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
const prompt = `Foydalanuvchi kvartira qidiryapti. Uning yozgan gapi: "salom"
Vazifangiz: Shu gapdan viloyat (yoki shahar), tuman, xonalar soni va maksimal narxni ajratib olib JSON formatida qaytarish.
Qoidalar: 
- Narxni so'mda ifodalang (masalan, 3mln = 3000000 yoki 300 dollar = taxminan 3800000). Agar aytilmagan bo'lsa null bo'lsin.
- Agar tuman aytilmagan bo'lsa, null bo'lsin. Agar "Toshkent" desa, region: "Toshkent", district: null.
- Faqat JSON qaytaring. Boshqa matn kerak emas.

{
  "region": "Toshkent",
  "district": "Chilonzor",
  "rooms": 2,
  "maxPrice": 4000000
}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  })
}).then(r => r.json()).then(d => {
  const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("TEXT:", t);
  console.log("PARSED:", JSON.parse(t));
}).catch(console.error);

const t0 = Date.now();
fetch('https://sih26034-ai.onrender.com/health').then(async r => {
  console.log(r.status, await r.text());
}).catch(console.error);

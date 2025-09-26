import express from 'express';

const app = express();
app.use(express.json());

const store = Object.create(null);

app.post('/token', (req, res) => {
  res.json({ access_token: 'mock-token-123', token_type: 'Bearer', expires_in: 3600 });
});

app.post('/dds/submit', (req, res) => {
  const ts = Date.now();
  const referenceNumber = `MOCK-REF-${String(ts).slice(-6)}`;
  const verificationNumber = `MOCK-VER-${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`;

  const record = {
    referenceNumber,
    verificationNumber,
    status: 'SUBMITTED',
    payload: req.body
  };
  store[referenceNumber] = record;
  res.json(record);
});

app.get('/dds/:ref', (req, res) => {
  const rec = store[req.params.ref];
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

app.post('/dds/:ref/retract', (req, res) => {
  const rec = store[req.params.ref];
  if (!rec) return res.status(404).json({ error: 'Not found' });
  rec.status = 'RETRACTED';
  res.json(rec);
});

const port = 3000;
app.listen(port, () => {
  console.log(`Mock TRACES API listening on http://localhost:${port}`);
});

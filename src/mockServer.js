import express from "express";

const app = express();
app.use(express.json());

// DB in-memory delle DDS
const store = Object.create(null);

// Token endpoint (sempre valido nel mock)
app.post("/token", (req, res) => {
  res.json({ access_token: "mock-token-123", token_type: "Bearer", expires_in: 3600 });
});

// Submit DDS
app.post("/dds/submit", (req, res) => {
  const ts = Date.now();
  const referenceNumber = `MOCK-REF-${String(ts).slice(-6)}`;
  const verificationNumber = `MOCK-VER-${Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, "0")}`;

  const record = {
    referenceNumber,
    verificationNumber,
    status: "SUBMITTED",
    payload: req.body
  };

  store[referenceNumber] = record;
  res.json(record);
});

// Retrieve DDS
app.get("/dds/:ref", (req, res) => {
  const rec = store[req.params.ref];
  if (!rec) return res.status(404).json({ error: "DDS not found" });
  res.json(rec);
});

// Retract DDS
app.post("/dds/:ref/retract", (req, res) => {
  const rec = store[req.params.ref];
  if (!rec) return res.status(404).json({ error: "DDS not found" });
  rec.status = "RETRACTED";
  res.json(rec);
});

// --- Nuova funzionalità: popolamento DDS di test ---
// --- DDS di test precaricate ---
const states = ["VALID", "SUBMITTED", "RETRACTED", "AMENDED"];

for (let i = 1; i <= 30; i++) {
  const ref = `MOCK-REF-${100000 + i}`;
  const ver = `MOCK-VER-${String(i).padStart(3, "0")}`;

  // Assegna stato ciclico (VALID più frequente, SUBMITTED/RETRACTED/AMENDED occasionali)
  let status;
  if (i % 5 === 0) status = "RETRACTED";        // ogni 5° ritirata
  else if (i % 7 === 0) status = "AMENDED";     // ogni 7° emendata
  else if (i % 9 === 0) status = "SUBMITTED";   // ogni 9° appena inviata
  else status = "VALID";                        // default: valida

  store[ref] = {
    referenceNumber: ref,
    verificationNumber: ver,
    status,
    payload: { note: `DDS di test n.${i}`, createdAt: new Date().toISOString() }
  };
}

const port = 3000;
app.listen(port, () => {
  console.log(`Mock TRACES API listening on http://localhost:${port}`);
});

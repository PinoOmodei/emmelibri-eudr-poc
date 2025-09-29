import express from "express";
import fs from "fs";
import { parse } from "csv-parse/sync";

const app = express();
app.use(express.json());

// --- Caricamento DDS da CSV ---
const csvPath = "./TRACES-DDS.csv";
let store = {};

function loadStore() {
  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const rows = parse(content, { columns: true });

    const newStore = {};
    for (const row of rows) {
      const {
        referenceNumber,
        verificationNumber,
        status,
        operatorId,
        operatorName,
        productId,
        productType,
        quantity,
        country
      } = row;

      // Struttura gerarchica coerente con TRACES API
      const record = {
        referenceNumber,
        verificationNumber,
        status,
        operator: {
          id: operatorId,
          name: operatorName
        },
        products: [
          {
            id: productId,
            type: productType,
            quantity: Number(quantity),
            countryOfProduction: country
          }
        ],
        submissionDate: new Date().toISOString(), // mock generico
        lastModified: new Date().toISOString(),
        history: [
          {
            timestamp: new Date().toISOString(),
            action: status
          }
        ]
      };

      newStore[referenceNumber] = record;
    }
    store = newStore;
    console.log(`📥 Caricate ${Object.keys(store).length} DDS da ${csvPath}`);
  } catch (err) {
    console.error("Errore nel caricamento del CSV:", err);
  }
}

// Caricamento iniziale
loadStore();

// Endpoint per ricaricare manualmente il CSV (utile in fase di test)
app.post("/reload", (req, res) => {
  loadStore();
  res.json({ message: "Store ricaricato da CSV", size: Object.keys(store).length });
});

// --- Endpoint TRACES Mock ---

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
    operator: req.body.operator || { id: "OP-000", name: "Unknown" },
    products: req.body.products || [],
    submissionDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    history: [
      {
        timestamp: new Date().toISOString(),
        action: "SUBMITTED"
      }
    ]
  };

  store[referenceNumber] = record;
  res.json(record);
});

// Retrieve DDS
app.get("/dds/:reference/:verification", (req, res) => {
  const { reference, verification } = req.params;
  const rec = store[reference];
  if (!rec) return res.status(404).json({ error: "DDS not found" });
  if (rec.verificationNumber !== verification) {
    return res.status(400).json({ error: "Reference and verification number do not match" });
  }
  res.json(rec);
});

// Retract DDS
app.post("/dds/:reference/:verification/retract", (req, res) => {
  const { reference, verification } = req.params;
  const rec = store[reference];
  if (!rec) return res.status(404).json({ error: "DDS not found" });
  if (rec.verificationNumber !== verification) {
    return res.status(400).json({ error: "Reference and verification number do not match" });
  }
  rec.status = "RETRACTED";
  rec.lastModified = new Date().toISOString();
  rec.history.push({
    timestamp: new Date().toISOString(),
    action: "RETRACTED"
  });
  res.json(rec);
});

// --- Avvio server ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mock TRACES server in ascolto su http://localhost:${PORT}`);
});


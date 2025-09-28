import express from "express";
import cors from "cors";
import { resetDB, initDB, getRecords } from "./db.js";
import { exportCSV, exportONIX } from "./exportForClients.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { ingestFile } from "./ingest.js";
import { ingestOnly, validateOnly, createTraderOnly } from "./ingest.js";




const app = express();
const PORT = process.env.PORT || 4000;

// Cartella temporanea per l'upload (cfr. endpoin /ingest)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: path.join(__dirname, "..", "uploads/") });

// ✅ Abilita CORS
app.use(cors());

// Middleware JSON
app.use(express.json());

// Endpoint di test
app.get("/", (req, res) => {
  res.send("✅ Emmelibri EUDR PoC API attiva");
});

// Storico run (ex showRecords)
app.get("/records", async (req, res) => {
  await initDB();
  const records = await getRecords();
  res.json(records);
});

// EXPORT (CSV o ONIX) con gestione errore
app.get("/export/:type", async (req, res) => {
  try {
    let filePath;
    if (req.params.type === "csv") {
      filePath = await exportCSV();
    } else if (req.params.type === "onix") {
      filePath = await exportONIX();
    } else {
      throw new Error("Formato export non supportato");
    }

    res.download(filePath);
  } catch (err) {
    console.error("Errore export:", err.message);
    res.status(400).json({ error: err.message });
  }
});

/* Versioni vecchie endpoin export ... senza gestione errori
// Export CSV
app.get("/export/csv", async (req, res) => {
  const filePath = await exportCSV();
  res.download(filePath);
});

// Export ONIX
app.get("/export/onix", async (req, res) => {
  const filePath = await exportONIX();
  res.download(filePath);
});
*/

// Ingest (solo parse CSV)
app.post("/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nessun file CSV caricato" });

    const records = await ingestOnly(req.file.path);
    res.json({ message: "Ingest completato", records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validazione DDS ricevute
app.post("/validate", async (req, res) => {
  try {
    const { records } = req.body; // i record devono arrivare dal client
    if (!records) return res.status(400).json({ error: "Nessun record da validare" });

    const validated = await validateOnly(records);
    res.json({ message: "Validazione completata", validated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creazione DDS Trader
app.post("/dds/trader", async (req, res) => {
  try {
    const { validated } = req.body; // i record validati devono arrivare dal client
    if (!validated) return res.status(400).json({ error: "Nessun record validato in input" });

    const traderDDS = await createTraderOnly(validated);
    res.json({ message: "DDS TRADER creata", traderDDS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pipeline completa: upload CSV + validazione + creazione DDS TRADER
app.post("/pipeline", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file CSV caricato" });
    }

    const result = await ingestFile(req.file.path);

    res.json({
      message: "Pipeline completata con successo",
      traderDDS: result.traderDDS,
      validated: result.validated,
    });
  } catch (err) {
    console.error("Errore pipeline:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reset DB
app.post("/reset", async (req, res) => {
  try {
    await initDB();
    await resetDB();
    res.json({ message: "DB azzerato con successo" });
  } catch (err) {
    console.error("Errore reset DB:", err);
    res.status(500).json({ error: err.message });
  }
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`);
});

import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { initDB, getRecords, saveRecord, getRecordById } from "./db.js";
import fs from "fs";
import csvParser from "csv-parser"; // per leggere input.csv
import { exportCSV, exportONIX, exportForClientsAll } from "./exportForClients.js";


// strong-soap è CommonJS → import come default e destruttura
import pkg from "strong-soap";
const { soap: soapClient } = pkg;

import { ingestFile } from "./ingest.js";
import { ingestOnly, validateOnly, createTraderOnly } from "./ingest.js";

// ESM fix per __dirname e __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Upload folder
const upload = multer({ dest: path.join(__dirname, "..", "uploads/") });

// Middlewares
app.use(cors());
app.use(express.json());

// Endpoint di test
app.get("/", (req, res) => {
  res.send("✅ Emmelibri EUDR PoC API SOAP Adapter attivo");
});

// --- URL dei WSDL esposti via HTTP ---
const wsdlSubmissionHttpUrl = `http://localhost:4000/wsdl/EUDRSubmissionService.wsdl`;
const wsdlRetrievalHttpUrl = `http://localhost:4000/wsdl/EUDRRetrievalService.wsdl`;

// --- Endpoint SOAP del mock ---
const SOAP_URL_SUBMIT = "http://localhost:3000/soap/submission";
const SOAP_URL_RETRIEVE = "http://localhost:3000/soap/retrieval";

// --- Helpers ---
function generateInternalReference() {
  return `PROT-${Date.now()}`;
}

// parsing CSV in array di record { EAN, referenceNumber, verificationNumber }
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

// --- Endpoint DDS: Submit ---
app.post("/dds/submit", async (req, res) => {
  try {
    const {
      operatorId,
      operatorName,
      role,
      productId,
      productType,
      quantity,
      country,
      referencedDDS
    } = req.body;

    // ✅ Wrapper corretto come da WSDL: SubmitDDSRequest → dds
    const request = {
      SubmitDDSRequest: {
        dds: {
          internalReferenceNumber: generateInternalReference(),
          operatorId: operatorId || "OP-EMMELIBRI",
          operatorName: operatorName || "Emmelibri S.p.A.",
          role: role || "TRADER",
          productId: productId || "4902",
          productType: productType || "Libri",
          quantity: quantity || 1,
          country: country || "IT",
          referencedDDS: referencedDDS || []
        }
      }
    };

    soapClient.createClient(wsdlSubmissionHttpUrl, {}, (err, client) => {
      if (err) {
        console.error("❌ Errore in createClient (submitDDS):", err);
        return reject(err);
      }

      client.setEndpoint(SOAP_URL_SUBMIT);

      // 🔎 Log XML inviato e risposta grezza
      /*client.on("request", (xml) => {
        console.log("➡️  SOAP REQUEST (submitDDS):\n", xml);
      });
      client.on("response", (body, response) => {
        console.log("⬅️  SOAP RESPONSE (raw): status", response && response.statusCode, "\n", body);
      });
      client.on("soapError", (e) => {
        console.error("💥 SOAP FAULT (submitDDS):", e && (e.body || e));
      });*/

      // Chiamata SOAP
      client.submitDDS(request, (err, result) => {
        if (err) {
          console.error("❌ Errore SOAP submitDDS:", err);
          return res.status(500).json({ error: err.message });
        }

        // Alcuni client restituiscono result.SubmitDDSResponse, altri già "flat"
        const payload = result.SubmitDDSResponse || result;

        res.json({
          message: "✅ Submit DDS completata",
          internalReferenceNumber: request.SubmitDDSRequest.dds.internalReferenceNumber,
          result: payload
        });
      });
    });
  } catch (err) {
    console.error("❌ Errore generale submitDDS:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint DDS: Retrieve ---
app.get("/dds/:referenceNumber/:verificationNumber", async (req, res) => {
  try {
    const { referenceNumber, verificationNumber } = req.params;
    const request = { referenceNumber, verificationNumber };

    soapClient.createClient(wsdlRetrievalHttpUrl, {}, (err, client) => {
      if (err) {
        console.error("❌ Errore in createClient (retrieveDDS):", err);
        return reject(err);
      }

      client.setEndpoint(SOAP_URL_RETRIEVE);

      client.getStatementByIdentifiers(request, (err, result) => {
        if (err) {
          console.error("❌ Errore SOAP getStatementByIdentifiers:", err);
          return res.status(500).json({ error: err.message });
        }

        const payload =
          result.GetStatementByIdentifiersResponse?.dds || result.dds;

        res.json({
          message: "✅ Retrieve DDS completata",
          result: payload
        });
      });
    });
  } catch (err) {
    console.error("❌ Errore generale getStatementByIdentifiers:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint ingest (CSV + SOAP flow) ---
// Richiede: csv-parser, initDB/saveRecord da db.js, parseCSV(filePath) helper già definita
app.post("/api/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nessun file CSV caricato" });
    const {
      operatorId = "OP-EMMELIBRI",
      operatorName = "Emmelibri S.p.A.",
      role = "TRADER",
      productId = "490199",
      productName = "Books",
    } = req.body;

    const records = await parseCSV(req.file.path);

    // 1) Raggruppa per (referenceNumber+verificationNumber) e accumula EAN
    const ddsMap = {};
    for (const rec of records) {
      const key = `${rec.referenceNumber}-${rec.verificationNumber}`;
      if (!ddsMap[key]) {
        ddsMap[key] = {
          referenceNumber: rec.referenceNumber,
          verificationNumber: rec.verificationNumber,
          quantity: Number(rec.netWeightKG || 0),
          eanList: []
        };
      }
      ddsMap[key].eanList.push(rec.EAN);
    }

    // Helper: normalizza il motivo dell'invalidità da un SOAP fault
    const normalizeFaultReason = (err) => {
      const raw = String((err && (err.body || err.message)) || err || "").toUpperCase();
      if (raw.includes("NOT FOUND")) return "NOT_FOUND";
      if (raw.includes("INVALID")) return "INVALID";
      return "SOAP_FAULT";
    };

    // Helper: chiama retrieve una sola volta per DDS e NON rigetta su fault
    async function retrieveDDSOnce(referenceNumber, verificationNumber) {
      return new Promise((resolve) => {
        soapClient.createClient(wsdlRetrievalHttpUrl, {}, (e1, client) => {
          if (e1) return resolve({ ok: false, statusDetail: normalizeFaultReason(e1) });
          client.setEndpoint(SOAP_URL_RETRIEVE);

          // Log SOAP per debug
          /*client.on("request", (xml) => {
            console.log("➡️  SOAP REQUEST (retreiveDDS):\n", xml);
          });
          client.on("response", (body, response) => {
            console.log("⬅️  SOAP RESPONSE (raw): status", response && response.statusCode, "\n", body);
          });
          client.on("soapError", (e) => {
            console.error("💥 SOAP FAULT (retreiveDDS):", e && (e.body || e));
          });*/

          client.getStatementByIdentifiers({ referenceNumber, verificationNumber }, (e2, resSoap) => {
            if (e2) return resolve({ ok: false, statusDetail: normalizeFaultReason(e2) });
            const dds = resSoap?.GetStatementByIdentifiersResponse?.dds || resSoap?.dds;
            if (!dds) return resolve({ ok: false, statusDetail: "NO_RESPONSE" });
            if (dds.status === "VALID") return resolve({ ok: true, dds });
            return resolve({ ok: false, statusDetail: "INVALID" });
          });
        });
      });
    }

    // 2) Valida ogni DDS (no duplicati)
    const validDDS = [];
    const invalidDDS = [];

    for (const key of Object.keys(ddsMap)) {
      const dds = ddsMap[key];
      const outcome = await retrieveDDSOnce(dds.referenceNumber, dds.verificationNumber);
      if (outcome.ok) {
        validDDS.push({ ...dds, status: "VALID" });
      } else {
        invalidDDS.push({ ...dds, status: "INVALID", statusDetail: outcome.statusDetail });
      }
    }

    // 3) Crea DDS TRADER con referencedDDS validi
    const internalRef = `ING-${Date.now()}`;
    const totalQuantity = validDDS.reduce((acc, d) => acc + Number(d.quantity || 0), 0);

    const traderRequest = {
      SubmitDDSRequest: {
        dds: {
          internalReferenceNumber: internalRef,
          operatorId,
          operatorName,
          role,
          productId,
          productName,
          quantity: totalQuantity,   // 👈 aggiunta
          referencedDDS: validDDS.map(d => ({
            referenceNumber: d.referenceNumber,
            verificationNumber: d.verificationNumber
          }))
        }
      }
    };

    const traderDDS = await new Promise((resolve, reject) => {
      soapClient.createClient(wsdlSubmissionHttpUrl, {}, (e1, client) => {
        if (e1) return reject(e1);
        client.setEndpoint(SOAP_URL_SUBMIT);

        // Log SOAP per debug
        /*client.on("request", (xml) => {
          console.log("➡️  SOAP REQUEST (submitDDS):\n", xml);
        });
        client.on("response", (body, response) => {
          console.log("⬅️  SOAP RESPONSE (raw): status", response && response.statusCode, "\n", body);
        });
        client.on("soapError", (e) => {
          console.error("💥 SOAP FAULT (submitDDS):", e && (e.body || e));
        });*/

        client.submitDDS(traderRequest, (e2, result) => {
          if (e2) return reject(e2);
          resolve(result.SubmitDDSResponse || result);
        });
      });
    });

    // 4) Costruisce record ingestion per DB

    // Costruisci set degli EAN coperti da DDS valide
    const eanWithValid = new Set();
    for (const d of validDDS) {
      for (const ean of d.eanList) {
        eanWithValid.add(ean);
      }
    }

    // Classifica tutti gli EAN
    const eanList = Array.from(new Set(records.map(r => r.EAN))).map(ean => ({
      ean,
      hasValidDDS: eanWithValid.has(ean)
    }));

    const ingestionRecord = {
      internalReferenceNumber: internalRef,
      timestamp: new Date().toISOString(),
      ddsTrader: {
        referenceNumber: traderDDS.referenceNumber,
        verificationNumber: traderDDS.verificationNumber,
        status: traderDDS.status,
        referencedDDS: validDDS.map(d => ({
          referenceNumber: d.referenceNumber,
          verificationNumber: d.verificationNumber
        }))
      },
      // NB: qui manteniamo EAN per ciascun DDS fornitore, senza duplicati di DDS
      ddsFornitore: [
        ...validDDS.map(d => ({
          referenceNumber: d.referenceNumber,
          verificationNumber: d.verificationNumber,
          status: "VALID",
          eanList: d.eanList
        })),
        ...invalidDDS.map(d => ({
          referenceNumber: d.referenceNumber,
          verificationNumber: d.verificationNumber,
          status: "INVALID",
          statusDetail: d.statusDetail,   // <- evidenzia NOT_FOUND / INVALID / SOAP_FAULT / NO_RESPONSE
          eanList: d.eanList
        }))
      ],
      eanList
    };

    await initDB();
    await saveRecord(ingestionRecord);

    // 5) Risposta con summary che evidenzia i NOT_FOUND
    const notFoundCount = invalidDDS.filter(d => d.statusDetail === "NOT_FOUND").length;
    res.json({
      message: "✅ Ingest completata",
      summary: {
        totalDDS: Object.keys(ddsMap).length,
        valid: validDDS.length,
        invalid: invalidDDS.length,
        invalid_not_found: notFoundCount
      },
      ingestion: ingestionRecord
    });

  } catch (err) {
    console.error("❌ Errore ingest globale:", err);
    if (err?.stack) console.error("Stack:", err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.use("/wsdl", express.static(path.join(__dirname, "wsdl")));

// --- Endpoint Storico ingestion (lista) ---
app.get("/api/ingestions", async (req, res) => {
  try {
    await initDB();
    const records = await getRecords();

    const summaries = (records || []).map(r => ({
      internalReferenceNumber: r.internalReferenceNumber || "N/A",
      timestamp: r.timestamp || "N/A",
      totalEAN: Array.isArray(r.eanList) ? r.eanList.length : 0,
      ddsTraderStatus: r.ddsTrader?.status || "UNKNOWN"
    }));

    res.json(summaries);
  } catch (err) {
    console.error("❌ Errore in /api/ingestions:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint Storico ingestion (dettaglio) ---
app.get("/api/ingestions/:id", async (req, res) => {
  try {
    await initDB();
    const record = await getRecordById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: `Ingestion ${req.params.id} non trovata` });
    }

    // Normalizza campi mancanti per evitare undefined
    const safeRecord = {
      internalReferenceNumber: record.internalReferenceNumber || "N/A",
      timestamp: record.timestamp || "N/A",
      ddsTrader: {
        referenceNumber: record.ddsTrader?.referenceNumber || "N/A",
        verificationNumber: record.ddsTrader?.verificationNumber || "N/A",
        status: record.ddsTrader?.status || "UNKNOWN",
        referencedDDS: Array.isArray(record.ddsTrader?.referencedDDS)
          ? record.ddsTrader.referencedDDS
          : []
      },
      ddsFornitore: Array.isArray(record.ddsFornitore)
        ? record.ddsFornitore.map(d => ({
          referenceNumber: d.referenceNumber || "N/A",
          verificationNumber: d.verificationNumber || "N/A",
          status: d.status || "UNKNOWN",
          statusDetail: d.statusDetail || null,
          eanList: Array.isArray(d.eanList) ? d.eanList : []
        }))
        : [],
      eanList: Array.isArray(record.eanList)
        ? record.eanList.map(e => ({ ean: e.ean || "N/A" }))
        : []
    };

    res.json(safeRecord);
  } catch (err) {
    console.error("❌ Errore in /api/ingestions/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- EXPORT (CSV o ONIX o TUTTI) ---
app.get("/api/export/:type", async (req, res) => {
  try {
    const type = req.params.type;
    let filePath;

    if (type === "csv") {
      filePath = await exportCSV();
      return res.download(filePath);
    } else if (type === "onix") {
      filePath = await exportONIX();
      return res.download(filePath);
    } else if (type === "clients") {
      const results = await exportForClientsAll();
      // Rispondiamo con JSON (lista file generati)
      return res.json({
        message: "✅ Export completato per i clienti",
        files: results
      });
    } else {
      throw new Error("Formato export non supportato");
    }
  } catch (err) {
    console.error("❌ Errore export:", err.message);
    res.status(400).json({ error: err.message });
  }
});


// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 ServerSOAP avviato su http://localhost:${PORT}`);
});

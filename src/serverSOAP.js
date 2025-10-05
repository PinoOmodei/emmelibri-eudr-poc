import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { initDB, getRecords, saveRecord, getRecordById, updateRecordTraderRefVer } from "./db.js";
import fs from "fs";
import csvParser from "csv-parser"; // per leggere input.csv
import { exportCSV, exportONIX, exportForClientsAll } from "./exportForClients.js";
import { execFile } from "child_process";
import soap from "soap";
import dotenv from "dotenv";

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

// fetch da TRACES di un dds dall'UUID
async function fetchRefVerFromTraces(ddsIdentifier) {
  try {
    const { EUDR_RETRIEVE_WSDL, EUDR_USERNAME, EUDR_AUTH_KEY, EUDR_CLIENT_ID } = process.env;
    const client = await soap.createClientAsync(EUDR_RETRIEVE_WSDL);
    const wsSecurity = new soap.WSSecurity(EUDR_USERNAME, EUDR_AUTH_KEY, { passwordType: "PasswordDigest" });
    client.setSecurity(wsSecurity);
    client.addSoapHeader(
      { "base:WebServiceClientId": EUDR_CLIENT_ID },
      "",
      "base",
      "http://ec.europa.eu/sanco/tracesnt/base/v4"
    );

    const [result] = await client.getDdsInfoAsync({ identifier: [ddsIdentifier] });
    const info =
      result?.GetStatementInfoResponse?.statementInfo ||
      result?.GetDdsInfoResponse?.statementInfo?.[0] ||
      result?.statementInfo?.[0] ||
      result?.statementInfo ||
      result;
    return {
      referenceNumber: info?.referenceNumber || null,
      verificationNumber: info?.verificationNumber || null,
      status: info?.status || "UNKNOWN",
    };
  } catch (err) {
    console.error(`❌ Errore getDdsInfo(${ddsIdentifier}):`, err.message);
    return { referenceNumber: null, verificationNumber: null, status: "ERROR" };
  }
}

// --- Endpoint ingest (CSV + SOAP flow) ---
// Richiede: csv-parser, initDB/saveRecord da db.js, parseCSV(filePath) helper già definita

dotenv.config(); // Carica .env con le variabili TRACES

// --- Endpoint ingest (CSV + SOAP verso TRACES) ---
// === Funzione comune per ingest (CSV o TRACES) ===
async function processIngest(ddsMap, source = "CSV") {
  const {
    EUDR_RETRIEVE_WSDL,
    EUDR_SUBMIT_WSDL,
    EUDR_AUTH_KEY,
    EUDR_USERNAME,
    EUDR_CLIENT_ID,
    EUDR_OPERATOR_VAT,
    EUDR_OPERATOR_NAME,
    EUDR_OPERATOR_ADDRESS,
    EUDR_OPERATOR_EMAIL,
    EUDR_OPERATOR_PHONE,
    EUDR_COUNTRY,
  } = process.env;

  // === 1️⃣ Validazione DDS fornitore su TRACES ===
  console.log("➡️  Creazione client SOAP Retrieval...");
  const clientRetrieve = await soap.createClientAsync(EUDR_RETRIEVE_WSDL);
  const wsSecurityRetrieve = new soap.WSSecurity(EUDR_USERNAME, EUDR_AUTH_KEY, {
    passwordType: "PasswordDigest",
  });
  clientRetrieve.setSecurity(wsSecurityRetrieve);
  clientRetrieve.addSoapHeader(
    { "base:WebServiceClientId": EUDR_CLIENT_ID },
    "",
    "base",
    "http://ec.europa.eu/sanco/tracesnt/base/v4"
  );

  const validDDS = [];
  const invalidDDS = [];

  for (const key of Object.keys(ddsMap)) {
    const d = ddsMap[key];
    try {
      const [result] = await clientRetrieve.getStatementByIdentifiersAsync({
        referenceNumber: d.referenceNumber,
        verificationNumber: d.verificationNumber,
      });

      const statement =
        result?.GetStatementByIdentifiersResponse?.statement ||
        result?.statement ||
        result;
      const statusValue =
        statement?.status?.status ||
        statement?.status ||
        statement?.Status ||
        "UNKNOWN";

      console.log(`🧾 DDS ${d.referenceNumber}: stato=${statusValue}`);

      if (
        ["AVAILABLE", "VALID", "SUBMITTED", "REGISTERED", "CONFIRMED"].includes(
          statusValue.toUpperCase()
        )
      ) {
        validDDS.push({ ...d, status: statusValue });
      } else {
        invalidDDS.push({ ...d, status: statusValue });
      }
    } catch (err) {
      invalidDDS.push({
        ...d,
        status: "INVALID",
        statusDetail: err.message || "SOAP_FAULT",
      });
    }
  }

  // === 2️⃣ Costruzione e invio submitDDS TRADER ===
  if (validDDS.length === 0) {
    throw new Error("Nessun DDS di riferimento valido trovato su TRACES.\nCreazione del DDS Trader annullata.");
  }

  const referencedDDS = validDDS.map((v) => ({
    referenceNumber: v.referenceNumber,
    verificationNumber: v.verificationNumber,
  }));

  const INTERNAL_REF = `ING-${Date.now()}`;
  const TOTAL_QUANTITY = validDDS.reduce(
    (sum, v) => sum + (Number(v.quantity) || 0),
    0
  );

  console.log("➡️  Creazione client SOAP Submission...");
  const clientSubmit = await soap.createClientAsync(EUDR_SUBMIT_WSDL);
  const wsSecuritySubmit = new soap.WSSecurity(EUDR_USERNAME, EUDR_AUTH_KEY, {
    passwordType: "PasswordDigest",
  });
  clientSubmit.setSecurity(wsSecuritySubmit);
  clientSubmit.addSoapHeader(
    { "base:WebServiceClientId": EUDR_CLIENT_ID },
    "",
    "base",
    "http://ec.europa.eu/sanco/tracesnt/base/v4"
  );

  console.log("➡️  Invocazione submitDds (Trader, referenced DDS)...");

  const args = {
    operatorType: "OPERATOR",
    statement: {
      internalReferenceNumber: INTERNAL_REF,
      activityType: "DOMESTIC",
      operator: {
        referenceNumber: [
          {
            identifierType: "vat",
            identifierValue: EUDR_OPERATOR_VAT || "IT04640860153",
          },
        ],
        nameAndAddress: {
          "base:name": EUDR_OPERATOR_NAME || "Emmelibri S.p.A.",
          "base:country": EUDR_COUNTRY || "IT",
          "base:address":
            EUDR_OPERATOR_ADDRESS ||
            "Via G. Verdi, 8, 20057 Assago (MI)",
        },
        email: EUDR_OPERATOR_EMAIL || "info@example.com",
        phone: EUDR_OPERATOR_PHONE || "+390000000000",
      },
      countryOfActivity: EUDR_COUNTRY || "IT",
      commodities: [
        {
          position: 1,
          descriptors: {
            descriptionOfGoods: "Books",
            goodsMeasure: {
              supplementaryUnit: String(TOTAL_QUANTITY || "1"),
              supplementaryUnitQualifier: "NAR",
            },
          },
          hsHeading: "4901",
        },
      ],
      geoLocationConfidential: true,
      associatedStatements: referencedDDS,
    },
  };

  const [submitResult] = await clientSubmit.submitDdsAsync(args);
  const responseDDS =
    submitResult?.SubmitDdsResponse ||
    submitResult?.submitDdsResponse ||
    submitResult;

  console.log(
    "✅ Risultato submitDds:",
    JSON.stringify(responseDDS, null, 2)
  );

  // === 3️⃣ Salvataggio nel DB ===
  const ddsIdentifier =
    responseDDS?.ddsIdentifier ||
    responseDDS?.uuid ||
    null;

  const eanWithValid = new Set();
  validDDS.forEach((d) =>
    (d.eanList || []).forEach((e) => eanWithValid.add(e))
  );
  const allEans = Array.from(
    new Set([...validDDS, ...invalidDDS].flatMap((d) => d.eanList || []))
  );

  const eanList = allEans.map((ean) => ({
    ean,
    hasValidDDS: eanWithValid.has(ean),
  }));

  const record = {
    internalReferenceNumber: INTERNAL_REF,
    timestamp: new Date().toISOString(),
    source,
    ddsTrader: {
      ddsIdentifier,
      referenceNumber: responseDDS?.referenceNumber || null,
      verificationNumber: responseDDS?.verificationNumber || null,
      status: responseDDS?.status || "SUBMITTED",
      referencedDDS,
    },
    ddsFornitore: [
      ...validDDS.map((d) => ({ ...d, status: "VALID" })),
      ...invalidDDS.map((d) => ({ ...d, status: "INVALID" })),
    ],
    eanList,
  };

  await initDB();
  await saveRecord(record);

  return {
    message: `✅ Ingest completata (${source})`,
    traderDDS: responseDDS,
    summary: {
      totalDDS: Object.keys(ddsMap).length,
      valid: validDDS.length,
      invalid: invalidDDS.length,
    },
  };
}

// === Endpoint ingest classico (da CSV) ===
app.post("/api/ingest", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file CSV caricato" });
    }

    const records = await parseCSV(req.file.path);
    const ddsMap = {};

    for (const rec of records) {
      const key = `${rec.referenceNumber}-${rec.verificationNumber}`;
      if (!ddsMap[key]) {
        ddsMap[key] = {
          referenceNumber: rec.referenceNumber,
          verificationNumber: rec.verificationNumber,
          quantity: Number(rec.copies || 0),
          eanList: [],
        };
      }
      ddsMap[key].eanList.push(rec.EAN);
    }

    const summary = await processIngest(ddsMap, "CSV");
    res.json(summary);
  } catch (err) {
    console.error("❌ Errore ingest CSV:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Nuovo endpoint ingest da TRACES (JSON dal frontend) ===
app.post("/api/ingest/traces", async (req, res) => {
  try {
    const { ddsFornitore } = req.body;

    if (!Array.isArray(ddsFornitore) || ddsFornitore.length === 0) {
      return res.status(400).json({
        error: "Nessun DDS fornitore fornito nel payload",
      });
    }

    const ddsMap = {};
    for (const d of ddsFornitore) {
      const key = `${d.referenceNumber}-${d.verificationNumber}`;
      ddsMap[key] = {
        referenceNumber: d.referenceNumber,
        verificationNumber: d.verificationNumber,
        quantity: d.quantity || 0,
        eanList: d.eanList || [],
      };
    }

    const summary = await processIngest(ddsMap, "TRACES");
    res.json(summary);
  } catch (err) {
    console.error("❌ Errore ingest da TRACES:", err);
    res.status(500).json({ error: err.message });
  }
});


app.use("/wsdl", express.static(path.join(__dirname, "wsdl")));

// --- Endpoint Storico ingestion (lista) ---
app.get("/api/ingestions", async (req, res) => {
  try {
    await initDB();
    const records = await getRecords();

    // 🔄 Aggiornamento codici TRACES mancanti
    for (const r of records) {
      const trader = r.ddsTrader || {};
      if ((!trader.referenceNumber || !trader.verificationNumber) && trader.ddsIdentifier) {
        const latest = await fetchRefVerFromTraces(trader.ddsIdentifier);
        if (latest.referenceNumber && latest.verificationNumber) {
          console.log(`🔄 Aggiornato ${trader.ddsIdentifier}: ${latest.referenceNumber}/${latest.verificationNumber}`);
          await updateRecordTraderRefVer(
            r.internalReferenceNumber,
            latest.referenceNumber,
            latest.verificationNumber,
            latest.status
          );
          trader.referenceNumber = latest.referenceNumber;
          trader.verificationNumber = latest.verificationNumber;
          trader.status = latest.status;
        }
      }
    }

    // Poi costruisci i “summaries” come già facevi
    const summaries = (records || []).map(r => {
      const trader = r.ddsTrader || {};
      const hasCodes = trader.referenceNumber && trader.verificationNumber;
      //      const displayId = trader.ddsIdentifier || trader.referenceNumber || "N/A";

      // Se non ha ancora codici TRACES, mostra dicitura amichevole
      let statusLabel;
      if (!hasCodes) {
        statusLabel = `In attesa codici TRACES (status: ${trader.status || "SUBMITTED"})`;
      } else {
        statusLabel = trader.status || "UNKNOWN";
      }

      return {
        internalReferenceNumber: r.internalReferenceNumber || "N/A",
        timestamp: r.timestamp || "N/A",
        ddsIdentifier: r.ddsIdentifier,
        totalEAN: Array.isArray(r.eanList) ? r.eanList.length : 0,
        ddsTraderStatus: statusLabel
      };
    });

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
        ddsIdentifier: record.ddsTrader?.ddsIdentifier || "N/A",
        referenceNumber: record.ddsTrader?.referenceNumber || "N/A",
        verificationNumber: record.ddsTrader?.verificationNumber || "N/A",
        status:
          !record.ddsTrader?.referenceNumber || !record.ddsTrader?.verificationNumber
            ? `In attesa codici TRACES (status: ${record.ddsTrader?.status || "SUBMITTED"})`
            : record.ddsTrader?.status || "UNKNOWN",
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
        ? record.eanList.map(e => ({
          ean: e.ean || "N/A",
          hasValidDDS: !!e.hasValidDDS
        }))
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

// --- Endpoint REST: restituisce DDS TRADER per uno o più EAN (solo se VALID) ---
app.post("/api/trader-dds", async (req, res) => {
  try {
    const { eans } = req.body;
    if (!Array.isArray(eans)) {
      return res.status(400).json({ error: "Parametro 'eans' deve essere un array" });
    }

    await initDB();
    const records = await getRecords();

    // Costruisci mappa EAN -> DDS TRADER (come in exportForClients.js)
    const grouped = {};
    records.forEach((ing) => {
      ing.eanList
        .filter((e) => e.hasValidDDS) // solo EAN validi
        .forEach((row) => {
          if (!grouped[row.ean]) grouped[row.ean] = [];
          const ddsInfo = {
            ddsIdentifier: ing.ddsTrader.ddsIdentifier,
            referenceNumber: ing.ddsTrader.referenceNumber,
            verificationNumber: ing.ddsTrader.verificationNumber,
            status: ing.ddsTrader.status
          };
          if (
            !grouped[row.ean].some(
              (r) => r.referenceNumber === ddsInfo.referenceNumber
            )
          ) {
            grouped[row.ean].push(ddsInfo);
          }
        });
    });

    // Filtra solo quelli richiesti in input
    const result = eans.map((ean) => ({
      ean,
      ddsTrader: grouped[ean] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Errore in /api/trader-dds:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint di validazione ONIX + EUDR usando xmllint di sistema
app.post("/api/validate-onix", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file ONIX caricato" });
    }

    const schemaPath = path.join(__dirname, "..", "public", "schemas", "onix-eudr-wrapper.xsd");
    const xmlPath = req.file.path;

    execFile("xmllint", ["--noout", "--schema", schemaPath, xmlPath], (error, stdout, stderr) => {
      if (error) {
        // xmllint restituisce errore di validazione come exitCode ≠ 0
        return res.status(400).json({
          valid: false,
          errors: stderr
            .split("\n")
            .filter(line => line.trim().length > 0)
        });
      }

      res.json({ valid: true, message: "✅ File ONIX valido rispetto a ONIX+EUDR" });
    });
  } catch (err) {
    console.error("❌ Errore generale validazione ONIX:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Endpoint: recupero DDS ML-EDIT da TRACES ===
// Restituisce tutte le DDS “fornitore” (internalReferenceNumber che inizia con ML-EDIT)
app.get("/api/traces/ml-edit", async (req, res) => {
  try {
    const {
      EUDR_RETRIEVE_WSDL,
      EUDR_USERNAME,
      EUDR_AUTH_KEY,
      EUDR_CLIENT_ID,
      EUDR_TEST_INTERNAL_REF
    } = process.env;

    // Default: filtra per ML-EDIT se non specificato diversamente
    const filterRef = EUDR_TEST_INTERNAL_REF || "ML-EDIT";

    console.log(`➡️  Creazione client SOAP...`);
    const client = await soap.createClientAsync(EUDR_RETRIEVE_WSDL);

    // 🔐 Autenticazione WS-Security
    const wsSecurity = new soap.WSSecurity(EUDR_USERNAME, EUDR_AUTH_KEY, {
      passwordType: "PasswordDigest"
    });
    client.setSecurity(wsSecurity);

    // 🧩 Header SOAP con ClientId (obbligatorio)
    client.addSoapHeader(
      { "base:WebServiceClientId": EUDR_CLIENT_ID },
      "",
      "base",
      "http://ec.europa.eu/sanco/tracesnt/base/v4"
    );

    console.log("➡️  Invocazione metodo getDdsInfoByInternalReferenceNumber...");
    const [result, rawResponse, soapHeader, rawRequest] =
      await client.getDdsInfoByInternalReferenceNumberAsync(filterRef);

    // 🧾 Estrarre il blocco statementInfo (array di DDS)
    const statements =
      result?.GetDdsInfoByInternalReferenceNumberResponse?.statementInfo ||
      result?.statementInfo ||
      [];

    if (!Array.isArray(statements) || statements.length === 0) {
      console.warn("⚠️  Nessuna DDS trovata su TRACES per il filtro:", filterRef);
      return res.json([]);
    }

    console.log(`✅ DDS ML-EDIT trovate: ${statements.length}`);

    // 🔄 Mappa in un formato semplificato per il frontend
    const ddsList = statements.map((s) => ({
      identifier: s.identifier || null,
      internalReferenceNumber: s.internalReferenceNumber || null,
      referenceNumber: s.referenceNumber || null,
      verificationNumber: s.verificationNumber || null,
      status: s.status || "UNKNOWN",
      date: s.date || null,
      updatedBy: s.updatedBy || null,
      operatorName: "Messaggerie Libri", // dati fittizi per simulazione fornitore
      product: "Libri",
      quantity: 100,
      activityType: "DOMESTIC"
    }));

    // Filtra solo le DDS AVAILABLE (quelle “pronte”)
    // const availableDDS = ddsList.filter(
    //  (d) => d.status && d.status.toUpperCase() === "AVAILABLE"
    // );

    // Restituzione finale
    res.json(ddsList);
  } catch (err) {
    console.error("❌ Errore in /api/traces/ml-edit:", err);
    res.status(500).json({ error: err.message || "Errore generico TRACES" });
  }
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🚀 ServerSOAP avviato su http://localhost:${PORT}`);
});

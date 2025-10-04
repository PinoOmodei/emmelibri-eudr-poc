import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDB, getRecords, updateRecordTraderRefVer } from "./db.js";
import soap from "soap";
import dotenv from "dotenv";

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 cartella export
const EXPORT_DIR = path.join(__dirname, "..", "EXPORT");
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR);
}

// --- Funzione di supporto: recupera da TRACES i dati DDS (Reference Number e Verification Code) 
async function fetchRefVerFromTraces(ddsIdentifier) {
  try {
    const { EUDR_RETRIEVE_WSDL, EUDR_USERNAME, EUDR_AUTH_KEY, EUDR_CLIENT_ID } = process.env;
    const client = await soap.createClientAsync(EUDR_RETRIEVE_WSDL);

    // WS-Security
    const wsSecurity = new soap.WSSecurity(EUDR_USERNAME, EUDR_AUTH_KEY, {
      passwordType: "PasswordDigest"
    });
    client.setSecurity(wsSecurity);

    // Header con ClientId
    client.addSoapHeader(
      { "base:WebServiceClientId": EUDR_CLIENT_ID },
      "",
      "base",
      "http://ec.europa.eu/sanco/tracesnt/base/v4"
    );

    // ✅ Metodo esposto nel WSDL, ma risponde con GetStatementInfoResponse
    const [result, rawResponse, soapHeader, rawRequest] = await client.getDdsInfoAsync({
      identifier: [ddsIdentifier]
    });

    // 🔍 Estrazione flessibile
    const info =
      result?.GetStatementInfoResponse?.statementInfo ||
      result?.GetDdsInfoResponse?.statementInfo?.[0] ||
      result?.statementInfo?.[0] ||
      result?.statementInfo ||
      result;

    const ref = info?.referenceNumber || null;
    const ver = info?.verificationNumber || null;
    const status = info?.status || "UNKNOWN";

    console.log(`🔍 TRACES → ${ddsIdentifier}: REF=${ref} VER=${ver} STATUS=${status}`);

    return { referenceNumber: ref, verificationNumber: ver, status };
  } catch (err) {
    console.error(`❌ Errore getDdsInfo(${ddsIdentifier}):`, err.message);
    return { referenceNumber: null, verificationNumber: null, status: "ERROR" };
  }
}


// --- Funzione di supporto: costruisce la mappa EAN → DDS TRADER (da tutte le ingestion)
async function buildGrouped() {
  await initDB();
  const records = await getRecords();
  if (!records.length) throw new Error("Nessuna ingestion trovata nel DB");

  const grouped = {};

  for (const ing of records) {
    const trader = ing.ddsTrader || {};

    // 🔎 Se mancano i codici TRACES ma abbiamo ddsIdentifier, recuperali ora
    if ((!trader.referenceNumber || !trader.verificationNumber) && trader.ddsIdentifier) {
      const latest = await fetchRefVerFromTraces(trader.ddsIdentifier);
      if (latest.referenceNumber && latest.verificationNumber) {
        console.log(`🔄 Aggiornato ${trader.ddsIdentifier}: ${latest.referenceNumber}/${latest.verificationNumber}`);
        // Aggiorna in memoria
        trader.referenceNumber = latest.referenceNumber;
        trader.verificationNumber = latest.verificationNumber;
        trader.status = latest.status;
        // Aggiorna anche nel DB
        await updateRecordTraderRefVer(ing.internalReferenceNumber, latest.referenceNumber, latest.verificationNumber, latest.status);
      } else {
        console.log(`⚠️ Nessun codice ancora disponibile per ${trader.ddsIdentifier}`);
      }
    }

    // ❌ Salta le DDS ancora senza codici TRACES
    if (!trader.referenceNumber || !trader.verificationNumber) continue;

    // 🔗 Costruisci la mappa EAN -> DDS TRADER
    ing.eanList
      .filter(e => e.hasValidDDS)
      .forEach(row => {
        if (!grouped[row.ean]) grouped[row.ean] = [];
        const ddsInfo = {
          referenceNumber: trader.referenceNumber,
          verificationNumber: trader.verificationNumber,
          status: trader.status
        };
        if (!grouped[row.ean].some(r => r.referenceNumber === ddsInfo.referenceNumber)) {
          grouped[row.ean].push(ddsInfo);
        }
      });
  }

  return grouped;
}

// --- Export CSV (unico file cumulativo)
export async function exportCSV() {
  const grouped = await buildGrouped();

  const lines = ["EAN,AssociatedDDS"];
  for (const [ean, ddsList] of Object.entries(grouped)) {
    const refs = ddsList.map(d => `${d.referenceNumber}+${d.verificationNumber}`);
    lines.push(`${ean},"${refs.join("; ")}"`);
  }

  const fileName = `export_${Date.now()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

// --- Export ONIX (unico file cumulativo)
export async function exportONIX() {
  const grouped = await buildGrouped();

  const products = Object.entries(grouped).map(([ean, ddsList]) => {
    const ddsXml = ddsList.map((r) => `
      <eudr:DDSInfo>
        <eudr:ReferenceNumber>${r.referenceNumber}</eudr:ReferenceNumber>
        <eudr:VerificationNumber>${r.verificationNumber}</eudr:VerificationNumber>
      </eudr:DDSInfo>`).join("\n");

    return `
    <Product xmlns:eudr="http://www.emmelibri.it/eudr">
      <RecordReference>${ean}</RecordReference>
      ${ddsXml}
    </Product>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage xmlns="http://ns.editeur.org/onix/3.0/reference"
             xmlns:eudr="http://www.emmelibri.it/eudr"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://www.emmelibri.it/eudr schemas/eudr-extension.xsd">
  ${products}
</ONIXMessage>`;

  const fileName = `export_${Date.now()}.onix`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, xml, "utf8");
  return filePath;
}

// --- Export per tutti i clienti (più file)
export async function exportForClientsAll() {
  const grouped = await buildGrouped();

  // leggi anagrafica clienti
  const clientsPath = path.join(__dirname, "../clients.json");
  if (!fs.existsSync(clientsPath)) throw new Error("File clients.json non trovato");
  const clients = JSON.parse(fs.readFileSync(clientsPath, "utf8")).clients;

  const results = [];
  for (const client of clients) {
    const ts = Date.now();
    const ext = client.format.toLowerCase();
    const fileName = `${client.code}_${ts}.${ext}`;
    const filePath = path.join(EXPORT_DIR, fileName);

    if (client.format === "CSV") {
      const lines = ["EAN,AssociatedDDS"];
      for (const [ean, ddsList] of Object.entries(grouped)) {
        const refs = ddsList.map(d => `${d.referenceNumber}+${d.verificationNumber}`);
        lines.push(`${ean},"${refs.join("; ")}"`);
      }
      fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    } else if (client.format === "ONIX") {
      const products = Object.entries(grouped).map(([ean, ddsList]) => {
        const ddsXml = ddsList.map((r) => `
          <eudr:DDSInfo>
            <eudr:ReferenceNumber>${r.referenceNumber}</eudr:ReferenceNumber>
            <eudr:VerificationNumber>${r.verificationNumber}</eudr:VerificationNumber>
          </eudr:DDSInfo>`).join("\n");
        return `
        <Product xmlns:eudr="http://www.emmelibri.it/eudr">
          <RecordReference>${ean}</RecordReference>
          ${ddsXml}
        </Product>`;
      }).join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage xmlns="http://ns.editeur.org/onix/3.0/reference"
             xmlns:eudr="http://www.emmelibri.it/eudr"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://www.emmelibri.it/eudr schemas/eudr-extension.xsd">
  ${products}
</ONIXMessage>`;
      fs.writeFileSync(filePath, xml, "utf8");
    }

    results.push({ client: client.code, file: filePath });
  }

  return results;
}

// Modalità CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--csv") {
    exportCSV().then((f) => console.log(`✅ Export CSV creato: ${f}`));
  } else if (mode === "--onix") {
    exportONIX().then((f) => console.log(`✅ Export ONIX creato: ${f}`));
  } else if (mode === "--all") {
    exportForClientsAll().then((files) => {
      files.forEach(f => console.log(`✅ Export per cliente creato: ${f.file}`));
    });
  } else {
    console.log("Uso: node src/exportForClients.js --csv | --onix | --all");
  }
}

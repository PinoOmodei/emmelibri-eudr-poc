import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDB, getRecords } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📂 cartella export
const EXPORT_DIR = path.join(__dirname, "..", "EXPORT");
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR);
}

// Funzione: export CSV
export async function exportCSV() {
  await initDB();
  const records = await getRecords();
  if (!records.length) throw new Error("Nessun record trovato nel DB");

  const lastRun = records[records.length - 1];
  const lines = ["EAN,TraderReferenceNumber,TraderVerificationNumber"];
  lastRun.validated.forEach((row) => {
    lines.push(`${row.ean},${lastRun.traderDDS.referenceNumber},${lastRun.traderDDS.verificationNumber}`);
  });

  const fileName = `export_${Date.now()}.csv`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

// Funzione: export ONIX (XML semplificato + estensione eudr:)
export async function exportONIX() {
  await initDB();
  const records = await getRecords();
  if (!records.length) throw new Error("Nessun record trovato nel DB");

  const lastRun = records[records.length - 1];
  const items = lastRun.validated
    .map((row) => {
      return `
    <Product xmlns:eudr="http://www.emmelibri.it/eudr">
      <RecordReference>${row.ean}</RecordReference>
      <eudr:DDSInfo>
        <eudr:ReferenceNumber>${lastRun.traderDDS.referenceNumber}</eudr:ReferenceNumber>
        <eudr:VerificationNumber>${lastRun.traderDDS.verificationNumber}</eudr:VerificationNumber>
        <eudr:NetWeightKG>${row.netWeightKG || 0}</eudr:NetWeightKG>
      </eudr:DDSInfo>
    </Product>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ONIXMessage xmlns="http://ns.editeur.org/onix/3.0/reference"
             xmlns:eudr="http://www.emmelibri.it/eudr"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="http://www.emmelibri.it/eudr schemas/eudr-extension.xsd">
  ${items}
</ONIXMessage>`;

  const fileName = `export_${Date.now()}.xml`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, xml, "utf8");
  return filePath;
}

// Modalità CLI (manteniamo compatibilità)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--csv") {
    exportCSV().then((f) => console.log(`✅ Export CSV creato: ${f}`));
  } else if (mode === "--onix") {
    exportONIX().then((f) => console.log(`✅ Export ONIX creato: ${f}`));
  } else {
    console.log("Uso: node src/exportForClients.js --csv | --onix");
  }
}

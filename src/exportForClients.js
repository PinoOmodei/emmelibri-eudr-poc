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

  // Raggruppa per EAN
  const grouped = {};
  lastRun.validated.forEach((row) => {
    if (!grouped[row.ean]) grouped[row.ean] = [];
    grouped[row.ean].push(`${row.referenceNumber}+${row.verificationNumber}`);
  });

  // Costruisci righe CSV
  const lines = ["EAN,AssociatedDDS"];
  for (const [ean, ddsList] of Object.entries(grouped)) {
    lines.push(`${ean},"${ddsList.join("; ")}"`);
  }

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

  // Raggruppa per EAN
  const grouped = {};
  lastRun.validated.forEach((row) => {
    if (!grouped[row.ean]) grouped[row.ean] = [];
    grouped[row.ean].push({
      referenceNumber: row.referenceNumber,
      verificationNumber: row.verificationNumber,
      netWeightKG: row.netWeightKG || 0
    });
  });

  // Costruisci XML ONIX
  const products = Object.entries(grouped).map(([ean, rows]) => {
    const ddsXml = rows.map((r) => `
      <eudr:DDSInfo>
        <eudr:ReferenceNumber>${r.referenceNumber}</eudr:ReferenceNumber>
        <eudr:VerificationNumber>${r.verificationNumber}</eudr:VerificationNumber>
        <eudr:NetWeightKG>${r.netWeightKG}</eudr:NetWeightKG>
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

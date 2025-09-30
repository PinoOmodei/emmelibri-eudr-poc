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

// --- Funzione di supporto: costruisce la mappa EAN → DDS TRADER (da tutte le ingestion)
async function buildGrouped() {
  await initDB();
  const records = await getRecords();
  if (!records.length) throw new Error("Nessuna ingestion trovata nel DB");

  const grouped = {};
  records.forEach((ing) => {
    ing.eanList.forEach((row) => {
      if (!grouped[row.ean]) grouped[row.ean] = [];
      const ddsInfo = {
        referenceNumber: ing.ddsTrader.referenceNumber,
        verificationNumber: ing.ddsTrader.verificationNumber
      };
      // evita duplicati
      if (!grouped[row.ean].some(r => r.referenceNumber === ddsInfo.referenceNumber)) {
        grouped[row.ean].push(ddsInfo);
      }
    });
  });
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

  const fileName = `export_${Date.now()}.xml`;
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



/*import fs from "fs";
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
}*/

import fs from "fs";
import path from "path";

function randomEAN() {
  return "978" + Math.floor(1000000000000 + Math.random() * 9000000000000); // 13 cifre
}

function randomWeight() {
  return Math.floor(25 + Math.random() * 975); // tra 25 e 1000
}

// genera un set di DDS coerenti
function generateDDSPool(size = 30) {
  const pool = [];
  for (let i = 1; i <= size; i++) {
    pool.push({
      referenceNumber: `MOCK-REF-${100000 + i}`,
      verificationNumber: `MOCK-VER-${String(i).padStart(3, "0")}`
    });
  }
  return pool;
}

export function generateCSV(records, folder = "CSV") {
  // se records non è passato, scegli un numero casuale tra 15 e 30
  const rowCount = records || Math.floor(15 + Math.random() * 16);

  const header = "EAN,referenceNumber,verificationNumber,netWeightKG\n";
  const rows = [];

  // pool di DDS disponibili
  const ddsPool = generateDDSPool(30);

  // insieme di EAN casuali (circa metà del numero di righe)
  const eans = Array.from({ length: Math.ceil(rowCount / 2) }, () => randomEAN());

  for (let i = 0; i < rowCount; i++) {
    const ean = eans[Math.floor(Math.random() * eans.length)];
    const dds = ddsPool[Math.floor(Math.random() * ddsPool.length)];
    rows.push(`${ean},${dds.referenceNumber},${dds.verificationNumber},${randomWeight()}`);
  }

  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  const filename = path.join(folder, `input_${Date.now()}.csv`);
  fs.writeFileSync(filename, header + rows.join("\n"));
  return filename;
}

// se lanciato direttamente
if (process.argv[1].includes("generateCSV.js")) {
  const file = generateCSV();
  console.log("✅ CSV generato:", file);
}

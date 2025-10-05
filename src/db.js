import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../db.json");

const adapter = new JSONFile(file);
const db = new Low(adapter, { records: [] });

export async function initDB() {
  await db.read();
  db.data ||= { records: [] };
}

export async function saveRecord(record) {
  db.data.records.push(record);
  await db.write();
}

export async function getRecords() {
  await db.read();
  return db.data.records;
}

export async function getRecordById(id) {
  await db.read();
  return db.data.records.find(r => r.internalReferenceNumber === id);
}

export async function resetDB() {
  db.data = { records: [] };
  await db.write();
  console.log("✅ db.json azzerato");
}

export async function updateRecordTraderRefVer(internalRef, ref, ver, status) {
  await initDB(); // legge il file e prepara db.data
  const record = db.data.records.find(r => r.internalReferenceNumber === internalRef);
  if (record) {
    record.ddsTrader.referenceNumber = ref;
    record.ddsTrader.verificationNumber = ver;
    record.ddsTrader.status = status;
    await db.write(); // salva le modifiche su file
    console.log(`✅ Record ${internalRef} aggiornato`);
  } else {
    console.warn(`⚠️ Nessun record trovato con internalReferenceNumber=${internalRef}`);
  }
}
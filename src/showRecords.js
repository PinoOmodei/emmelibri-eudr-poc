import { initDB, getRecords } from "./db.js";

async function main() {
  await initDB();
  const records = await getRecords();

  if (records.length === 0) {
    console.log("⚠️ Nessun record presente in db.json");
    return;
  }

  console.log(`📚 Storico DDS TRADER (${records.length} record):\n`);

  records.forEach((rec, idx) => {
    console.log(`--- Record ${idx + 1} ---`);
    console.log(`Timestamp: ${rec.timestamp}`);
    console.log(`CSV Input: ${rec.inputFile || "N/D"}`);
    console.log(
      `DDS TRADER: ${rec.traderDDS.referenceNumber} (${rec.traderDDS.verificationNumber}) - Stato: ${rec.traderDDS.status}`
    );
    console.log("DDS ricevute e validate:");
    console.table(
      rec.validated.map((v) => ({
        EAN: v.ean,
        Reference: v.referenceNumber,
        Verification: v.verificationNumber,
        PesoKG: v.netWeightKG,
        Stato: v.status,
        Esito: v.validation
      }))
    );
    console.log("\n");
  });
}

main().catch((err) => {
  console.error("Errore showRecords:", err);
  process.exit(1);
});

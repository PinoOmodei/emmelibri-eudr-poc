import { initDB, resetDB, saveRecord } from "./db.js";
import { generateCSV } from "./generateCSV.js";
import { ingestCSV, validateDDS, createTraderDDS } from "./ingest.js";
import path from "path";

async function main() {
    const args = process.argv.slice(2);
    const shouldReset = args.includes("--reset");

    await initDB();
    if (shouldReset) {
        await resetDB();
    }

    // genera CSV casuale
    const file = generateCSV(null, "CSV");
    console.log("📄 Nuovo CSV generato:", file);

    // ingest + validazione
    const records = await ingestCSV(file);
    const validated = await validateDDS(records);

    // crea DDS TRADER
    const traderDDS = await createTraderDDS(validated);
    if (traderDDS) {
        await saveRecord({
            timestamp: new Date().toISOString(),
            inputFile: path.basename(file), // 👉 salva solo il nome del CSV
            traderDDS,
            validated
        });
        console.log("✅ DDS TRADER salvata in db.json");
    }
}

main().catch((err) => {
    console.error("Errore run.js:", err);
    process.exit(1);
});

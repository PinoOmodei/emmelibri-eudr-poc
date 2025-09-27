import fs from "fs";
import { parse } from "csv-parse";
import axios from "axios";
import { initDB, saveRecord } from "./db.js";

// ---- Ingest CSV ----
export async function ingestCSV(filePath) {
    const records = [];
    const parser = fs
        .createReadStream(filePath)
        .pipe(parse({ columns: true, trim: true }));

    for await (const record of parser) {
        records.push({
            ean: record.EAN,
            referenceNumber: record.referenceNumber,
            verificationNumber: record.verificationNumber,
            netWeightKG: parseFloat(record.netWeightKG) || 0
        });
    }
    return records;
}

// ---- Validazione DDS ----
export async function validateDDS(records, apiBase = "http://localhost:3000") {
    const results = [];

    for (const rec of records) {
        try {
            const { data } = await axios.get(`${apiBase}/dds/${rec.referenceNumber}`);

            const valid =
                data &&
                data.status === "VALID" && // solo lo stato VALID è accettato
                data.verificationNumber === rec.verificationNumber;

            results.push({
                ...rec,
                validation: valid ? "VALIDA" : "NON VALIDA",
                status: data.status
            });
        } catch (err) {
            results.push({
                ...rec,
                validation: "NON TROVATA",
                status: "N/A"
            });
        }
    }

    return results;
}

// ---- Creazione DDS TRADER ----
export async function createTraderDDS(validatedRecords, apiBase = "http://localhost:3000") {
    const validDDS = validatedRecords.filter((r) => r.validation === "VALIDA");

    if (validDDS.length === 0) {
        console.log("Nessuna DDS valida trovata, nessuna DDS TRADER creata.");
        return null;
    }

    // Calcola peso netto totale (somma dei kg dichiarati nelle DDS valide)
    const totalWeight = validDDS.reduce((sum, r) => sum + (r.netWeightKG || 0), 0);

    // Deduplica le DDS per referenceNumber
    const seen = new Set();
    const uniqueAssociated = [];
    for (const r of validDDS) {
        if (!seen.has(r.referenceNumber)) {
            seen.add(r.referenceNumber);
            uniqueAssociated.push({
                referenceNumber: r.referenceNumber,
                verificationNumber: r.verificationNumber
            });
        }
    }

    const traderPayload = {
        operatorType: "TRADER",
        activityType: "TRADE",
        countryOfActivity: "IT",
        commodities: [
            {
                hsHeading: "4901",
                descriptors: {
                    descriptionOfGoods: "Libri",
                    goodsMeasure: {
                        netWeight: totalWeight,
                        units: "KG"
                    }
                }
            }
        ],
        operator: {
            nameAndAddress: {
                name: "EMMELIBRI",
                country: "IT",
                address: "Via Roma 1, Milano"
            },
            email: "pino.omodei@meli.it"
        },
        associatedStatements: uniqueAssociated,
        internalReferenceNumber: `TRADER-POC-${Date.now()}`
    };

    const { data } = await axios.post(`${apiBase}/dds/submit`, traderPayload, {
        headers: { Authorization: "Bearer mock-token-123" }
    });

    return data;
}

// -- pipeline di acquisizione, validazione e generazione
export async function ingestFile(filePath, apiBase = "http://localhost:3000") {
    // 1. Ingestione CSV
    const records = await ingestCSV(filePath);

    // 2. Validazione DDS
    const validated = await validateDDS(records, apiBase);

    // 3. Creazione DDS TRADER
    const traderDDS = await createTraderDDS(validated, apiBase);

    // 4. Salvataggio su DB (se creata)
    if (traderDDS) {
        await initDB();
        await saveRecord({
            timestamp: new Date().toISOString(),
            traderDDS,
            validated
        });
    }

    // 5. Ritorna il risultato
    return { validated, traderDDS };
}

// --- Separazione della pipeline in step separati ---
// Step 1: ingest solo CSV
export async function ingestOnly(filePath) {
  const records = await ingestCSV(filePath);
  return records;
}

// Step 2: validate DDS
export async function validateOnly(records, apiBase = "http://localhost:3000") {
  return await validateDDS(records, apiBase);
}

// Step 3: create trader DDS
export async function createTraderOnly(validated, apiBase = "http://localhost:3000") {
  const traderDDS = await createTraderDDS(validated, apiBase);
  if (traderDDS) {
    await initDB();
    await saveRecord({
      timestamp: new Date().toISOString(),
      traderDDS,
      validated
    });
  }
  return traderDDS;
}


// ---- Demo standalone ----
if (process.argv[1].includes("ingest.js")) {
    const file = process.argv[2] || "input.csv";

    ingestCSV(file)
        .then((records) => validateDDS(records))
        .then(async (validated) => {
            console.log("Risultati validazione:");
            console.table(validated, ["ean", "referenceNumber", "status", "validation"]);

            const traderDDS = await createTraderDDS(validated);
            if (traderDDS) {
                console.log("\nNuova DDS TRADER creata:");
                console.log(JSON.stringify(traderDDS, null, 2));

                // 👉 Salva su DB
                await initDB();
                await saveRecord({
                    timestamp: new Date().toISOString(),
                    traderDDS,
                    validated
                });

                console.log("✅ Record salvato in db.json");
            }

        })
        .catch((err) => console.error("Errore:", err));
}

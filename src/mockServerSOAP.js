import fs from "fs";
import path from "path";
import http from "http";
import soap from "strong-soap";
import { parse } from "csv-parse/sync";
import express from "express";
import { fileURLToPath } from "url";

const { soap: soapServer } = soap;

// --- Caricamento DDS da CSV ---
const csvPath = "./TRACES-DDS.csv";
let store = {};

function loadStore() {
    try {
        const content = fs.readFileSync(csvPath, "utf-8");
        const rows = parse(content, { columns: true });

        const newStore = {};
        for (const row of rows) {
            const {
                referenceNumber,
                verificationNumber,
                status,
                operatorId,
                operatorName,
                productId,
                productType,
                quantity,
                country
            } = row;

            newStore[referenceNumber] = {
                referenceNumber,
                verificationNumber,
                status,
                operator: { id: operatorId, name: operatorName },
                products: [
                    {
                        id: productId,
                        type: productType,
                        quantity: Number(quantity),
                        countryOfProduction: country
                    }
                ],
                submissionDate: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                referencedDDS: []
            };
        }
        store = newStore;
        console.log(`📥 Caricate ${Object.keys(store).length} DDS da ${csvPath}`);
    } catch (err) {
        console.error("Errore nel caricamento del CSV:", err);
    }
}

loadStore();

// --- WSDL ---
const wsdlRetrieval = fs.readFileSync(
    path.resolve("./src/wsdl/EUDRRetrievalService.wsdl"),
    "utf-8"
);
const wsdlSubmission = fs.readFileSync(
    path.resolve("./src/wsdl/EUDRSubmissionService.wsdl"),
    "utf-8"
);

// --- Servizi SOAP ---
const services = {
    EUDRRetrievalService: {
        EUDRRetrievalPort: {
            getStatementByIdentifiers(args, cb) {
                const { referenceNumber, verificationNumber } = args;
                const rec = store[referenceNumber];
                if (!rec || rec.verificationNumber !== verificationNumber) {
                    return cb({
                        Fault: { faultcode: "Client", faultstring: "DDS not found or invalid" }
                    });
                }
                cb(null, {
                    GetStatementByIdentifiersResponse: {   // 👈 wrapper conforme al WSDL
                        dds: {
                            referenceNumber: rec.referenceNumber,
                            verificationNumber: rec.verificationNumber,
                            status: rec.status,
                            operatorId: rec.operator.id,
                            operatorName: rec.operator.name,
                            productId: rec.products[0].id,
                            productType: rec.products[0].type,
                            quantity: rec.products[0].quantity,
                            country: rec.products[0].countryOfProduction,
                            submissionDate: rec.submissionDate,
                            lastModified: rec.lastModified
                        }
                    }
                });
            }
        }
    },

    EUDRSubmissionService: {
        EUDRSubmissionPort: {
            submitDDS(args, cb) {
                // Log dettagliato dell'input
                console.log(">>> submitDDS args:", JSON.stringify(args, null, 2));

                // strong-soap passa direttamente { dds: { ... } }
                const dds = args.dds;

                if (!dds) {
                    return cb({
                        Fault: { faultcode: "Client", faultstring: "Invalid SubmitDDSRequest payload" }
                    });
                }

                // Normalizza referencedDDS
                let referenced = dds.referencedDDS || [];
                if (!Array.isArray(referenced)) referenced = [referenced];

                // Validazione DDS referenziate
                for (const ref of referenced) {
                    const found = store[ref.referenceNumber];
                    if (!found || found.verificationNumber !== ref.verificationNumber) {
                        return cb({
                            Fault: { faultcode: "Client", faultstring: `Referenced DDS not found: ${ref.referenceNumber}` }
                        });
                    }
                    if (found.status !== "VALID") {
                        return cb({
                            Fault: { faultcode: "Client", faultstring: `Referenced DDS not VALID: ${ref.referenceNumber}` }
                        });
                    }
                }

                // Genera identificativi mock
                const ts = Date.now();
                const referenceNumber = `MOCK-REF-${String(ts).slice(-6)}`;
                const verificationNumber = `MOCK-VER-${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`;
                const uuid = `UUID-${Math.floor(Math.random() * 1e9)}`;

                // Costruisci record interno
                const record = {
                    referenceNumber,
                    verificationNumber,
                    status: "SUBMITTED",
                    operator: {
                        id: dds.operatorId,
                        name: dds.operatorName,
                        role: dds.role || "OPERATOR"
                    },
                    internalReferenceNumber: dds.internalReferenceNumber || null,
                    products: [
                        {
                            id: dds.productId,
                            type: dds.productType,
                            quantity: Number(dds.quantity),
                            countryOfProduction: dds.country
                        }
                    ],
                    submissionDate: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    referencedDDS: referenced
                };

                // Salva nello store
                store[referenceNumber] = record;

                // Risposta SOAP conforme al WSDL
                return cb(null, {
                    SubmitDDSResponse: {
                        uuid,
                        referenceNumber,
                        verificationNumber,
                        status: record.status
                    }
                });
            }
        }
    }
};

// ✅ Serve i file WSDL come statici via HTTP
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use("/wsdl", express.static(path.join(__dirname, "wsdl")));

// --- Avvio server SOAP ---
const server = http.createServer((req, res) =>
    res.end("SOAP server running")
);
server.listen(3000, () => {
    console.log("🚀 SOAP Mock TRACES server listening on:");
    console.log("   Retrieval (SOAP):  http://localhost:3000/soap/retrieval");
    console.log("   Submission (SOAP): http://localhost:3000/soap/submission");
    console.log(`   WSDL (static)): http://localhost:3000/wsdl/`);
    soapServer.listen(server, "/soap/retrieval", services, wsdlRetrieval);
    soapServer.listen(server, "/soap/submission", services, wsdlSubmission);
});


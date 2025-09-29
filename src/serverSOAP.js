import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// strong-soap è CommonJS → import come default e destruttura
import pkg from "strong-soap";
const { soap: soapClient } = pkg;

import { ingestFile } from "./ingest.js";
import { ingestOnly, validateOnly, createTraderOnly } from "./ingest.js";

// ESM fix per __dirname e __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Upload folder
const upload = multer({ dest: path.join(__dirname, "..", "uploads/") });

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Serve i file WSDL come statici via HTTP
app.use("/wsdl", express.static(path.join(__dirname, "wsdl")));

// Endpoint di test
app.get("/", (req, res) => {
    res.send("✅ Emmelibri EUDR PoC API SOAP Adapter attivo");
});

// --- URL dei WSDL esposti via HTTP ---
const wsdlSubmissionHttpUrl = `http://localhost:${PORT}/wsdl/EUDRSubmissionService.wsdl`;
const wsdlRetrievalHttpUrl = `http://localhost:${PORT}/wsdl/EUDRRetrievalService.wsdl`;

// --- Endpoint SOAP del mock ---
const SOAP_URL_SUBMIT = "http://localhost:3000/soap-submission";
const SOAP_URL_RETRIEVE = "http://localhost:3000/soap";

// --- Helpers ---
function generateInternalReference() {
    return `PROT-${Date.now()}`;
}

// --- Endpoint DDS: Submit ---
app.post("/dds/submit", async (req, res) => {
    try {
        const {
            operatorId,
            operatorName,
            role,
            productId,
            productType,
            quantity,
            country,
            referencedDDS
        } = req.body;

        // ✅ Wrapper corretto come da WSDL: SubmitDDSRequest → dds
        const request = {
            SubmitDDSRequest: {
                dds: {
                    internalReferenceNumber: generateInternalReference(),
                    operatorId: operatorId || "OP-EMMELIBRI",
                    operatorName: operatorName || "Emmelibri S.p.A.",
                    role: role || "TRADER",
                    productId: productId || "4902",
                    productType: productType || "Libri",
                    quantity: quantity || 1,
                    country: country || "IT",
                    referencedDDS: referencedDDS || []
                }
            }
        };

        soapClient.createClient(wsdlSubmissionHttpUrl, {}, (err, client) => {
            if (err) {
                console.error("❌ Errore creazione client SOAP (submit):", err);
                return res.status(500).json({ error: err.message });
            }

            client.setEndpoint(SOAP_URL_SUBMIT);

            // 🔎 Log XML inviato e risposta grezza
            client.on("request", (xml) => {
                console.log("➡️  SOAP REQUEST (submitDDS):\n", xml);
            });
            client.on("response", (body, response) => {
                console.log("⬅️  SOAP RESPONSE (raw): status", response && response.statusCode, "\n", body);
            });
            client.on("soapError", (e) => {
                console.error("💥 SOAP FAULT (submitDDS):", e && (e.body || e));
            });

            // Chiamata SOAP
            client.submitDDS(request, (err, result) => {
                if (err) {
                    console.error("❌ Errore SOAP submitDDS:", err);
                    return res.status(500).json({ error: err.message });
                }

                // Alcuni client restituiscono result.SubmitDDSResponse, altri già "flat"
                const payload = result.SubmitDDSResponse || result;

                res.json({
                    message: "✅ Submit DDS completata",
                    internalReferenceNumber: request.SubmitDDSRequest.dds.internalReferenceNumber,
                    result: payload
                });
            });
        });
    } catch (err) {
        console.error("❌ Errore generale submitDDS:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Endpoint DDS: Retrieve ---
app.get("/dds/:referenceNumber/:verificationNumber", async (req, res) => {
    try {
        const { referenceNumber, verificationNumber } = req.params;
        const request = { referenceNumber, verificationNumber };

        soapClient.createClient(wsdlRetrievalHttpUrl, {}, (err, client) => {
            if (err) {
                console.error("❌ Errore creazione client SOAP (retrieve):", err);
                return res.status(500).json({ error: err.message });
            }

            client.setEndpoint(SOAP_URL_RETRIEVE);
            
            client.getStatementByIdentifiers(request, (err, result) => {
                if (err) {
                    console.error("❌ Errore SOAP getStatementByIdentifiers:", err);
                    return res.status(500).json({ error: err.message });
                }

                const payload =
                    result.GetStatementByIdentifiersResponse?.dds || result.dds;

                res.json({
                    message: "✅ Retrieve DDS completata",
                    result: payload
                });
            });
        });
    } catch (err) {
        console.error("❌ Errore generale getStatementByIdentifiers:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- Pipeline (come in server.js originale) ---
app.post("/pipeline", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Nessun file CSV caricato" });

        const result = await ingestFile(req.file.path);
        res.json({
            message: "Pipeline completata con successo",
            traderDDS: result.traderDDS,
            validated: result.validated
        });
    } catch (err) {
        console.error("Errore pipeline:", err);
        res.status(500).json({ error: err.message });
    }
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 ServerSOAP avviato su http://localhost:${PORT}`);
    console.log(`   WSDL disponibili su: http://localhost:${PORT}/wsdl/`);
});

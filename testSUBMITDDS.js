/**
 * testSUBMITDDS.js
 * Submit di una DDS come TRADER (senza geolocalizzazione) con DDS referenziate
 * Ricalca impostazione e sicurezza dal testRETRIEVE.js
 */

import soap from "soap";
import dotenv from "dotenv";

dotenv.config(); // Carica variabili da .env

// === Variabili d’ambiente attese ===
// WSDL dello Submission WS (Acceptance Cloud)
const WSDL = (process.env.EUDR_SUBMIT_WSDL || "").trim();

// WS-Security: EU Login + Authentication Key
const AUTH_KEY = (process.env.EUDR_AUTH_KEY || "").trim();
const USERNAME = (process.env.EUDR_USERNAME || "").trim();

// ClientId del WS (es. "eudr-test")
const CLIENT_ID = (process.env.EUDR_CLIENT_ID || "eudr-test").trim();

// Dati DDS (Trader) – esempio §7.2.4: trade scenario w/ referenced DDS (no geojson)
const INTERNAL_REF = (process.env.EUDR_INTERNAL_REF || "ML-DDS-TRADER-001").trim();
const OPERATOR_ID = (process.env.EUDR_OPERATOR_ID || "OP-EMMELIBRI").trim();
const OPERATOR_NAME = (process.env.EUDR_OPERATOR_NAME || "Emmelibri S.p.A.").trim();
const ROLE = "TRADER"; // 💡 IMPORTANTE: funzionerà solo se l’operatore ha ruolo Trader abilitato

// Dati prodotto/quantità (usare unità conformi alle Validation Rules)
const PRODUCT_ID = (process.env.EUDR_PRODUCT_ID || "49019900").trim(); // es. libri
const PRODUCT_NAME = (process.env.EUDR_PRODUCT_NAME || "Books").trim();
const QUANTITY = (process.env.EUDR_QUANTITY || "100").trim();
const SUPPL_UNIT = (process.env.EUDR_SUPPL_UNIT || "NAR").trim(); // esempio; verificare tabella unità
const SUPPL_UNIT_TYPE = (process.env.EUDR_SUPPL_UNIT_TYPE || "pieces").trim();

// DDS referenziate (supply chain) – coppie Reference + Verification dei fornitori
// Puoi passare una o più coppie (separate da virgola) nelle env seguenti
const REF_NUMBERS = (process.env.EUDR_REFERENCED_REFNUMS || "25ITQRBHJ68633").split(",").map(s => s.trim()).filter(Boolean);
const VER_NUMBERS = (process.env.EUDR_REFERENCED_VERNUMS || "68LGJVBQ").split(",").map(s => s.trim()).filter(Boolean);

if (!WSDL || !AUTH_KEY || !USERNAME || !CLIENT_ID) {
    console.error("❌ Manca una o più variabili obbligatorie: EUDR_SUBMIT_WSDL, EUDR_AUTH_KEY, EUDR_USERNAME, EUDR_CLIENT_ID");
    process.exit(1);
}

// Costruzione array referencedDDS allineando le coppie Ref/Ver
const referencedDDS = REF_NUMBERS.map((ref, i) => ({
    referenceNumber: ref,
    verificationNumber: VER_NUMBERS[i] || ""
})).filter(x => x.referenceNumber && x.verificationNumber);

if (referencedDDS.length === 0) {
    console.error("❌ Nessuna coppia Reference+Verification valida in EUDR_REFERENCED_REFNUMS/EUDR_REFERENCED_VERNUMS");
    process.exit(1);
}

async function main() {
    try {
        console.log("➡️  Creazione client SOAP...");
        const client = await soap.createClientAsync(WSDL);

        // WS-Security: UsernameToken Digest (username = EU Login, password = Authentication Key)
        const wsSecurity = new soap.WSSecurity(USERNAME, AUTH_KEY, { passwordType: "PasswordDigest" });
        client.setSecurity(wsSecurity);

        // Header SOAP con WebServiceClientId – usare forma oggetto con namespace (stabile)
        client.addSoapHeader(
            { "base:WebServiceClientId": CLIENT_ID },
            "",
            "base",
            "http://ec.europa.eu/sanco/tracesnt/base/v4"
        );

        // DEBUG: lista metodi disponibili (commentare quando non serve)
        // console.log("Metodi disponibili:", Object.keys(client));
        // console.log("Descrizione:", JSON.stringify(client.describe(), null, 2));


        console.log("➡️  Invocazione metodo submitDDS (Trader, referenced DDS)...");

        // Payload DDS ispirato all’esempio CF2 §7.2.4 (trade w/ referenced DDS, senza geojson)
        // === ARGOMENTI submitDds: ATTENZIONE all’ordine e ai tipi! ===
        const args = {
            // 1) semplice stringa: uno tra OPERATOR, TRADER, REPRESENTATIVE_OPERATOR, REPRESENTATIVE_TRADER
            operatorType: "OPERATOR",

            // 2) oggetto complesso "statement"
            statement: {
                // obbligatori lato business
                internalReferenceNumber: process.env.EUDR_INTERNAL_REF || "ML-DDS-TRADER-001",
                activityType: "DOMESTIC", // DOMESTIC, TRADE, IMPORT, EXPORT

                // Dati dell’operatore che presenta la DDS (noi)
                operator: {
                    referenceNumber: [
                        {
                            identifierType: "vat", // oppure eori, duns, ecc. → scegli quello che usi davvero
                            identifierValue: process.env.EUDR_OPERATOR_VAT || "IT04640860153"
                        }
                    ],
                    nameAndAddress: {
                        "base:name": process.env.EUDR_OPERATOR_NAME || "Emmelibri S.p.A.",
                        "base:country": process.env.EUDR_COUNTRY || "IT",
                        "base:address": process.env.EUDR_OPERATOR_ADDRESS || "Via G. Verdi, 8, 20057 Assago (MI)"
                    },
                    email: process.env.EUDR_OPERATOR_EMAIL || "pino.omodei@meli.it",
                    phone: process.env.EUDR_OPERATOR_PHONE || "+390245774358"
                },

                // Paese dell’attività (per TRADE: paese dove avviene la commercializzazione)
                countryOfActivity: process.env.EUDR_COUNTRY || "IT",

                // Merci/commodity (minimo 1 voce)
                commodities: [{
                    position: 1, // xs:long
                    descriptors: {
                        descriptionOfGoods: process.env.EUDR_PRODUCT_NAME || "Books",
                        goodsMeasure: {
                            // Per TRADER spesso bastano le supplementari (numero pezzi)
                            // supplementaryUnit è numerico (intero non negativo)
                            supplementaryUnit: String(process.env.EUDR_SUPPL_UNIT_AMOUNT || "100"),
                            // supplementaryUnitQualifier DEVE essere uno dei valori ammessi (es. NAR = pezzi/unità)
                            supplementaryUnitQualifier: process.env.EUDR_SUPPL_UNIT_QUALIFIER || "NAR"
                            // volume / netWeight: opzionali
                        }
                    },
                    hsHeading: process.env.EUDR_PRODUCT_ID || "4901"
                    // speciesInfo / producers / geometryGeojson: non necessari nello scenario trader senza geo
                }],

                // In scenario TRADER SENZA geo: indica la confidenzialità della geolocalizzazione (true/false)
                geoLocationConfidential: true,

                // Le DDS referenziate dei fornitori: Reference+Verification (obbligatorie per Trader)
                associatedStatements: referencedDDS
            }
        };

        const [result, rawResponse, soapHeader, rawRequest] = await client.submitDdsAsync(args);

        // Atteso: HTTP 200 + UUID generato (da usare in CF3)
        console.log("✅ Risultato submitDDS:", JSON.stringify(result, null, 2));

        // Per debug (commenta se non serve)
        console.log("📨 Request SOAP:", rawRequest);
        console.log("📩 Response SOAP:", rawResponse);

    } catch (err) {
        console.error("❌ Errore durante il test SUBMIT DDS:", err);
        if (err?.response?.data) {
            console.error("🧾 SOAP Fault body:", err.response.data);
        }
    }
}

main();

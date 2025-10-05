/**
 * testRETRIEVE.js
 * Test di connessione al servizio TRACES EUDR (operazioni di Retrieve DDS)
 */

import soap from "soap";
import dotenv from "dotenv";

dotenv.config(); // Carica variabili da .env

// Variabili d’ambiente attese
const WSDL = process.env.EUDR_RETRIEVE_WSDL;   // URL WSDL Retrieval (Acceptance Cloud)
const AUTH_KEY = process.env.EUDR_AUTH_KEY;        // Authentication key del WS Client
const USERNAME = process.env.EUDR_USERNAME || "n00j1o2p";        // EU Login username (es. n00j1o2p)
const CLIENT_ID = process.env.EUDR_CLIENT_ID || "eudr-test";

// Parametri di test (UUID e Internal Reference da CF2)
const TEST_UUID = process.env.EUDR_TEST_UUID || "UUID-DA-SOSTITUIRE";
const TEST_INTERNAL_REF = process.env.EUDR_TEST_INTERNAL_REF || "ML-DDS-001";

if (!WSDL || !AUTH_KEY || !USERNAME) {
    console.error("❌ Devi definire EUDR_RETRIEVE_WSDL, EUDR_AUTH_KEY, EUDR_USERNAME e EUDR_CLIENT_ID nel file .env");
    process.exit(1);
}

async function main() {
    try {
        console.log("➡️  Creazione client SOAP...");
        const client = await soap.createClientAsync(WSDL);

         // Autenticazione WS-Security
         const wsSecurity = new soap.WSSecurity(USERNAME, AUTH_KEY, { passwordType: "PasswordDigest" });
         client.setSecurity(wsSecurity);
 
         // Header SOAP con ClientId
         client.addSoapHeader(
             { "base:WebServiceClientId": CLIENT_ID },
             "",
             "base",
             "http://ec.europa.eu/sanco/tracesnt/base/v4"
         );
 
        // log dei metodi disponibili
        // DEBUG: console.log("Metodi disponibili:", Object.keys(client));

        /*
        // invocazione via UUID
        console.log("➡️  Invocazione metodo getDdsInfo (via UUID)...");
        const [resultUUID] = await client.getDdsInfoAsync({ uuid: [TEST_UUID] });
        console.log("✅ Risultato Retrieve (UUID):", JSON.stringify(resultUUID, null, 2));
        */

        // invocazione via INTERNAL REFERENCE
        console.log("➡️  Invocazione metodo getDdsInfoByInternalReferenceNumber...");
        const [resultRef, rawResponse, soapHeader, rawRequest] = await client.getDdsInfoByInternalReferenceNumberAsync(TEST_INTERNAL_REF);

        console.log("✅ Risultato Retrieve (Internal Reference):", JSON.stringify(resultRef, null, 2));

        console.log("📨 Request SOAP:", rawRequest);
        console.log("📩 Response SOAP:", rawResponse);

    } catch (err) {
        console.error("❌ Errore durante il test RETRIEVE:", err);
    }
}

main();

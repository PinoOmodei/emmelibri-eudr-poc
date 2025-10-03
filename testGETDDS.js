/**
 * testGETDDS.js
 * Recupero dettagli completi di un DDS usando Reference Number + Verification Number
 */

import soap from "soap";
import dotenv from "dotenv";

dotenv.config(); // Carica variabili da .env

// Variabili d’ambiente attese
const WSDL = process.env.EUDR_RETRIEVE_WSDL;   // URL WSDL Retrieval (Acceptance Cloud)
const AUTH_KEY = process.env.EUDR_AUTH_KEY;        // Authentication key del WS Client
const USERNAME = process.env.EUDR_USERNAME;        // EU Login username
const CLIENT_ID = process.env.EUDR_CLIENT_ID || "eudr-test";

// Parametri DDS (da Retrieve precedente)
const REFERENCE_NUMBER = process.env.EUDR_REFERENCE_NUMBER;    // Es. "25ITQRBHJ68633"
const VERIFICATION_NUMBER = process.env.EUDR_VERIFICATION_NUMBER; // Es. "68LGJVBQ"

if (!WSDL || !AUTH_KEY || !USERNAME || !REFERENCE_NUMBER || !VERIFICATION_NUMBER) {
    console.error("❌ Devi definire EUDR_RETRIEVE_WSDL, EUDR_AUTH_KEY, EUDR_USERNAME, EUDR_CLIENT_ID, EUDR_REFERENCE_NUMBER e EUDR_VERIFICATION_NUMBER nel file .env");
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

        console.log("➡️  Invocazione metodo getStatementByIdentifiers...");

        const args = {
            referenceNumber: REFERENCE_NUMBER,
            verificationNumber: VERIFICATION_NUMBER
        };

        const [result, rawResponse, soapHeader, rawRequest] =
            await client.getStatementByIdentifiersAsync(args);

        // Output leggibile
        console.log("✅ Dettagli DDS:");
        console.log(JSON.stringify(result, null, 2));

        // Messaggi SOAP scambiati
        // DEBUG: console.log("📨 Request SOAP:", rawRequest);
        // DEBUG: console.log("📩 Response SOAP:", rawResponse);

    } catch (err) {
        console.error("❌ Errore durante il test GETDDS:", err);
    }
}

main();

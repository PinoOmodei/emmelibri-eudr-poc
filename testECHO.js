/**
 * testTRACES.js
 * Test di connessione al servizio TRACES EUDR (operazione ECHO)
 */

import soap from "soap";
import dotenv from "dotenv";

dotenv.config(); // Carica variabili da .env

// Variabili d’ambiente attese
const WSDL = process.env.EUDR_ECHO_WSDL;       // URL del WSDL ECHO (Acceptance Cloud)
const AUTH_KEY = process.env.EUDR_AUTH_KEY;        // Authentication key del WS Client
const USERNAME = process.env.EUDR_USERNAME;        // EU Login username
const CLIENT_ID = process.env.EUDR_CLIENT_ID || "eudr-test";

if (!WSDL || !AUTH_KEY) {
    console.error("❌ Devi definire EUDR_ECHO_WSDL e EUDR_AUTH_KEY nel file .env");
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

        console.log("➡️  Invocazione metodo Echo...");

        // Argomenti richiesti dal WSDL (query)
        const args = { query: "Hello TRACES EUDR" };
        const [result, rawResponse, soapHeader, rawRequest] = await client.testEchoAsync(args);

        // Stampa output in console: risposta (result.status) e trace di Requeste e Response SOAP
        console.log("✅ Risultato Echo:", result.status);
        // DEBUG: console.log("📨 Request SOAP:", rawRequest);
        // DEBUG: console.log("📩 Response SOAP:", rawResponse);

    } catch (err) {
        console.error("❌ Errore durante il test ECHO:", err);
    }
}

main();
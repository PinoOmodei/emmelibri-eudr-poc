# Emmelibri EUDR PoC

Proof of Concept per la gestione di **DDS (Due Diligence Statements)** tramite API TRACES, con mock server, ingestione CSV, creazione DDS TRADER e export verso i clienti.

---

## 📦 Funzionalità principali

- **Mock TRACES API** (`src/mockServer.js`):
  - Endpoint `/token`, `/dds/submit`, `/dds/:ref`, `/dds/:ref/retract`.
  - DDS precaricate in vari stati (`VALID`, `SUBMITTED`, `RETRACTED`, `AMENDED`).

- **Ingestione dati** (`src/ingest.js`):
  - Legge un CSV con colonne:
    - `EAN` (titolo)
    - `referenceNumber`, `verificationNumber` (DDS)
    - `netWeightKG` (peso in kg)
  - Valida le DDS interrogando il mock server.
  - Crea una DDS **TRADER** intestata a *EMMELIBRI*, con `associatedStatements` deduplicati.

- **DB locale** (`db.json`, escluso da Git tramite `.gitignore`):
  - Gestito via [`lowdb`](https://www.npmjs.com/package/lowdb).
  - Tiene lo storico: timestamp, file CSV di input, DDS validate, DDS TRADER create.

- **Generazione CSV casuali** (`src/generateCSV.js`):
  - Genera file con 15–30 righe, relazioni molti-a-molti (stesso EAN con più DDS, stessa DDS con più EAN).
  - Salvati nella cartella `CSV/` (ignorata da Git).

- **Orchestratore** (`src/run.js`):
  - Genera un CSV casuale.
  - Esegue ingest, validazione e creazione DDS TRADER.
  - Salva tutto in `db.json`.
  - Opzione `--reset` per azzerare il DB prima della run.

- **Storico a console** (`src/showRecords.js`):
  - Mostra lo storico delle run in formato tabellare.
  - Indica anche il CSV di input utilizzato.

- **Export per clienti** (`src/exportForClients.js`):
  - Supporta due modalità di output:
    - **CSV** → `EAN, TraderReferenceNumber, TraderVerificationNumber`
    - **ONIX (XML)** → con estensione `eudr:DDSInfo`
  - I file generati vengono salvati in `EXPORT/` (ignorata da Git).

- **Schema di validazione XSD** (`schemas/eudr-extension.xsd`):
  - Namespace: `http://www.emmelibri.it/eudr`
  - Definisce l’elemento `<eudr:DDSInfo>` con:
    - `ReferenceNumber`
    - `VerificationNumber`
    - `NetWeightKG` (opzionale)
  - Usato per validare gli XML ONIX esportati.

---

## 🚀 Setup

1. Clona il repo e installa le dipendenze:
   ```bash
   npm install
   ```

2. Avvia il mock server TRACES:
   ```bash
   npm run start:mock
   ```
   (oppure: `node src/mockServer.js`)

3. Genera un CSV casuale ed esegui la pipeline completa:
   ```bash
   node src/run.js
   ```
   Con reset del DB:
   ```bash
   node src/run.js --reset
   ```

4. Consulta lo storico:
   ```bash
   node src/showRecords.js
   ```

5. Genera export per i clienti:
   ```bash
   node src/exportForClients.js --csv
   node src/exportForClients.js --onix
   ```

---

## 📂 Struttura progetto

```
emmelibri-eudr-poc/
├── CSV/                  # CSV di input generati (ignorati da Git)
├── EXPORT/               # Export per i clienti (ignorati da Git)
├── db.json               # DB locale (ignorato da Git)
├── schemas/
│   └── eudr-extension.xsd # Schema XSD per estensione ONIX con eudr:DDSInfo
├── package.json
└── src/
    ├── mockServer.js       # Mock API TRACES
    ├── ingest.js           # Ingestione CSV, validazione DDS, creazione TRADER DDS
    ├── db.js               # Gestione DB locale (lowdb)
    ├── generateCSV.js      # Generatore CSV casuali
    ├── run.js              # Orchestratore pipeline
    ├── showRecords.js      # Storico a console
    └── exportForClients.js # Export clienti (CSV o ONIX)
```

---

## ⚠️ Note importanti

- `db.json`, `CSV/` e `EXPORT/` sono **locali** e non vengono mai pushati su GitHub (vedi `.gitignore`).  
- Quando saranno disponibili le credenziali reali TRACES, sarà necessario introdurre il supporto al **codice proprietario della DDS** nelle chiamate API e alle strutture XML e CSV esportate verso i clienti.
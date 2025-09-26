# Emmelibri EUDR PoC

Proof of Concept per la gestione di **DDS (Due Diligence Statements)** tramite API TRACES, con mock server, ingestione CSV e salvataggio su DB locale.

---

## 📦 Funzionalità principali

- **Mock TRACES API** (`src/mockServer.js`):
  - Endpoint `/token`, `/dds/submit`, `/dds/:ref`, `/dds/:ref/retract`.
  - Precaricate 30 DDS in vari stati (`VALID`, `SUBMITTED`, `RETRACTED`, `AMENDED`).

- **Ingestione dati** (`src/ingest.js`):
  - Legge un CSV con colonne:
    - `EAN` (titolo)
    - `referenceNumber`, `verificationNumber` (DDS)
    - `netWeightKG` (peso in kg)
  - Valida le DDS interrogando il mock.
  - Crea una DDS **TRADER** intestata a *EMMELIBRI*, con `associatedStatements` deduplicati.

- **DB locale** (`db.json`, escluso da Git tramite `.gitignore`):
  - Gestito via [`lowdb`](https://www.npmjs.com/package/lowdb).
  - Tiene lo storico: timestamp, CSV usato, DDS TRADER creata e DDS validate.

- **Generazione CSV casuali** (`src/generateCSV.js`):
  - Crea file con 15–30 righe.
  - Relazioni molti-a-molti: stesso EAN con più DDS, stessa DDS con più EAN.
  - Salvati nella cartella `CSV/` (ignorata da Git).

- **Orchestratore** (`src/run.js`):
  - Genera CSV casuale.
  - Esegue ingest, validazione e creazione DDS TRADER.
  - Salva tutto in `db.json`.
  - Opzione `--reset` per azzerare il DB prima della run.

- **Storico a console** (`src/showRecords.js`):
  - Mostra tutti i record del DB in formato tabellare.
  - Riporta anche il nome del CSV di input.

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

---

## 📂 Struttura progetto

```
emmelibri-eudr-poc/
├── CSV/                  # CSV generati automaticamente (ignorati da Git)
├── db.json               # DB locale (ignorato da Git)
├── package.json
└── src/
    ├── mockServer.js     # Mock API TRACES
    ├── ingest.js         # Ingestione CSV, validazione DDS, creazione TRADER DDS
    ├── db.js             # Gestione DB locale (lowdb)
    ├── generateCSV.js    # Generatore CSV casuali
    ├── run.js            # Orchestratore
    └── showRecords.js    # Storico a console
```

---

## ⚠️ Note importanti

- `db.json` e i file in `CSV/` sono **locali** e non vengono mai pushati su GitHub (vedi `.gitignore`).  
- Quando in futuro verranno ricevute le credenziali reali per TRACES, sarà necessario rivedere il supporto al **codice proprietario della DDS**.

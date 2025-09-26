# Emmelibri EUDR PoC

Questo progetto è un **Proof of Concept** per la gestione delle DDS (Due Diligence Statement) tramite API EUDR/TRACES.

## Struttura progetto
```
emmelibri-eudr-poc/
├─ src/
│  ├─ config.js        # gestione variabili di configurazione (.env)
│  ├─ auth.js          # autenticazione OAuth2 (mock)
│  ├─ tracesClient.js  # funzioni client API (submit/retrieve/retract)
│  ├─ mockServer.js    # server Express che simula TRACES API
│  └─ index.js         # demo end-to-end
├─ .env                # variabili ambiente (mock o reali)
├─ package.json
├─ .gitignore
└─ README.md
```

## Requisiti
- Node.js >= 18
- npm

## Setup
1. Scompatta lo zip
2. Apri il progetto in VS Code
3. Installa le dipendenze:
   ```bash
   npm install
   ```

## Avvio
### 1. Avvia il server mock
```bash
npm run start:mock
```
Il mock server sarà disponibile su [http://localhost:3000](http://localhost:3000).

### 2. Esegui il client demo
Apri un nuovo terminale nella stessa cartella e lancia:
```bash
npm start
```
Vedrai a console:
- **Submitted** DDS (mock)
- **Retrieved** DDS
- **Retracted** DDS

## Configurazione
Le variabili si trovano in `.env`. Di default puntano al mock server:
```
TOKEN_URL=http://localhost:3000/token
API_BASE=http://localhost:3000
CLIENT_ID=mock-client-id
CLIENT_SECRET=mock-client-secret
```

Quando TRACES fornirà credenziali reali (Acceptance), basterà aggiornare questi valori.

## Note
- I dati DDS salvati nel mock sono **in memoria** e si perdono al riavvio.
- `index.js` è pensato come demo end-to-end: lo estenderemo con CLI e parsing CSV.

---
✦ Autore: Emmelibri Tech Team
# emmelibri-eudr-poc
# emmelibri-eudr-poc
# emmelibri-eudr-poc

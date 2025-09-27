import fs from "fs";
import path from "path";
import { initDB, getRecords } from "./db.js";

// Carica anagrafica clienti
function loadClients(file = "clients.json") {
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw).clients;
}

// Estrae mapping EAN → DDS da db.json
function buildEanDDSMap(records) {
  const map = {};

  for (const rec of records) {
    const operatorCode =
      rec.traderDDS?.operator?.operatorCode || "IT-EMMELIBRI-001";
    const operatorName =
      rec.traderDDS?.operator?.nameAndAddress?.name || "Emmelibri S.p.A.";

    for (const v of rec.validated) {
      if (v.validation === "VALIDA") {
        if (!map[v.ean]) {
          map[v.ean] = {
            ean: v.ean,
            ddsList: [],
            operatorCode,
            operatorName,
          };
        }
        const ddsKey = `${v.referenceNumber}+${v.verificationNumber}`;
        if (!map[v.ean].ddsList.includes(ddsKey)) {
          map[v.ean].ddsList.push(ddsKey);
        }
      }
    }
  }
  return Object.values(map);
}

// Export in CSV
function exportCSV(client, data, folder = "EXPORT") {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  const filename = path.join(folder, `${client.code}_${Date.now()}.csv`);
  const header = "EAN,TraderDDS,OperatorCode,OperatorName\n";

  const rows = data.map(
    (item) =>
      `${item.ean},"${item.ddsList.join(
        ";"
      )}",${item.operatorCode},"${item.operatorName}"`
  );

  fs.writeFileSync(filename, header + rows.join("\n"), "utf-8");
  console.log(`✅ Export CSV creato per ${client.name}: ${filename}`);
}

// Export in ONIX (con namespace EUDR)
function exportONIX(client, data, folder = "EXPORT") {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);

  const filename = path.join(folder, `${client.code}_${Date.now()}.xml`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ONIXMessage release="3.0"\n`;
  xml += `  xmlns="http://ns.editeur.org/onix/3.0/reference"\n`;
  xml += `  xmlns:eudr="http://www.emmelibri.it/eudr">\n`;

  xml += `  <Header>\n`;
  xml += `    <Sender>\n`;
  xml += `      <SenderName>EMMELIBRI</SenderName>\n`;
  xml += `      <ContactName>Pino Omodei</ContactName>\n`;
  xml += `      <EmailAddress>pino.omodei@meli.it</EmailAddress>\n`;
  xml += `    </Sender>\n`;
  xml += `    <SentDateTime>${new Date().toISOString()}</SentDateTime>\n`;
  xml += `  </Header>\n\n`;

  for (const item of data) {
    xml += `  <Product>\n`;
    xml += `    <ProductIdentifier>\n`;
    xml += `      <ProductIDType>15</ProductIDType>\n`;
    xml += `      <IDValue>${item.ean}</IDValue>\n`;
    xml += `    </ProductIdentifier>\n`;
    xml += `    <eudr:EUDRData>\n`;
    xml += `      <eudr:TraderOperator>\n`;
    xml += `        <eudr:OperatorCode>${item.operatorCode}</eudr:OperatorCode>\n`;
    xml += `        <eudr:OperatorName>${item.operatorName}</eudr:OperatorName>\n`;
    xml += `      </eudr:TraderOperator>\n`;
    xml += `      <eudr:TraderDDSList>\n`;
    for (const dds of item.ddsList) {
      xml += `        <eudr:TraderDDS>${dds}</eudr:TraderDDS>\n`;
    }
    xml += `      </eudr:TraderDDSList>\n`;
    xml += `    </eudr:EUDRData>\n`;
    xml += `  </Product>\n\n`;
  }

  xml += `</ONIXMessage>\n`;

  fs.writeFileSync(filename, xml, "utf-8");
  console.log(`✅ Export ONIX creato per ${client.name}: ${filename}`);
}

async function main() {
  await initDB();
  const records = await getRecords();

  if (records.length === 0) {
    console.log("⚠️ Nessun record disponibile in db.json, impossibile esportare.");
    return;
  }

  const clients = loadClients();
  const data = buildEanDDSMap(records);

  for (const client of clients) {
    if (client.format === "CSV") {
      exportCSV(client, data);
    } else if (client.format === "ONIX") {
      exportONIX(client, data);
    } else {
      console.log(`Formato non supportato per ${client.name}: ${client.format}`);
    }
  }
}

main().catch((err) => {
  console.error("Errore exportForClients:", err);
  process.exit(1);
});

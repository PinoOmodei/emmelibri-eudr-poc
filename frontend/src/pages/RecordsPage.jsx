import { useEffect, useState } from "react";

export default function RecordsPage() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then(setRecords);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Storico Run</h1>
      {records.length === 0 ? (
        <p>Nessun record trovato.</p>
      ) : (
        <table className="border border-gray-300 w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Timestamp</th>
              <th className="p-2 border">DDS TRADER</th>
              <th className="p-2 border">Stato</th>
              <th className="p-2 border">CSV Input</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={idx} className="border">
                <td className="p-2 border">{r.timestamp}</td>
                <td className="p-2 border">{r.traderDDS?.referenceNumber}</td>
                <td className="p-2 border">{r.traderDDS?.status}</td>
                <td className="p-2 border">{r.inputFile || "N/D"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

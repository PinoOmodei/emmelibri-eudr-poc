import { useEffect, useState } from "react";

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then(setRecords);
  }, []);

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-brand">Storico Run</h1>

      {records.length === 0 ? (
        <p className="text-gray-600">Nessun record trovato.</p>
      ) : (
        <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-brand text-white">
              <tr>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">DDS TRADER</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">CSV Input</th>
                <th className="px-4 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <>
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2 border-t">{r.timestamp}</td>
                    <td className="px-4 py-2 border-t">
                      {r.traderDDS?.referenceNumber}
                    </td>
                    <td className="px-4 py-2 border-t">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          r.traderDDS?.status === "VALID"
                            ? "bg-green-100 text-green-800"
                            : r.traderDDS?.status === "SUBMITTED"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {r.traderDDS?.status || "N/D"}
                      </span>
                    </td>
                    <td className="px-4 py-2 border-t">{r.inputFile || "N/D"}</td>
                    <td className="px-4 py-2 border-t">
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-brand hover:underline"
                      >
                        {expandedIndex === idx ? "Nascondi" : "Dettagli"}
                      </button>
                    </td>
                  </tr>

                  {expandedIndex === idx && (
                    <tr>
                      <td colSpan="5" className="p-4 bg-gray-50 border-t">
                        <h3 className="font-semibold text-gray-700 mb-2">
                          DDS validate
                        </h3>
                        {r.validated && r.validated.length > 0 ? (
                          <table className="w-full text-xs border border-gray-200 rounded">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-2 py-1 border">EAN</th>
                                <th className="px-2 py-1 border">Reference</th>
                                <th className="px-2 py-1 border">Verification</th>
                                <th className="px-2 py-1 border">Status</th>
                                <th className="px-2 py-1 border">NetWeight (kg)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.validated.map((d, j) => (
                                <tr key={j} className="odd:bg-white even:bg-gray-50">
                                  <td className="px-2 py-1 border">{d.ean}</td>
                                  <td className="px-2 py-1 border">{d.referenceNumber}</td>
                                  <td className="px-2 py-1 border">{d.verificationNumber}</td>
                                  <td className="px-2 py-1 border">{d.status}</td>
                                  <td className="px-2 py-1 border">{d.netWeightKG}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-gray-500 text-sm">Nessuna DDS valida.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/*import { useEffect, useState } from "react";

export default function RecordsPage() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then(setRecords);
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-brand">Storico Run</h1>

      {records.length === 0 ? (
        <p className="text-gray-600">Nessun record trovato.</p>
      ) : (
        <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-brand text-white">
              <tr>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">DDS TRADER</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">CSV Input</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-2 border-t">{r.timestamp}</td>
                  <td className="px-4 py-2 border-t">
                    {r.traderDDS?.referenceNumber}
                  </td>
                  <td className="px-4 py-2 border-t">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        r.traderDDS?.status === "VALID"
                          ? "bg-green-100 text-green-800"
                          : r.traderDDS?.status === "SUBMITTED"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {r.traderDDS?.status || "N/D"}
                    </span>
                  </td>
                  <td className="px-4 py-2 border-t">{r.inputFile || "N/D"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}*/

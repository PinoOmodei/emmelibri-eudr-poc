import { useEffect, useState } from "react";

export default function RecordsPage() {
  const [ingestions, setIngestions] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/ingestions")
      .then((res) => res.json())
      .then(setIngestions)
      .catch((err) => console.error("Errore caricamento ingestions:", err));
  }, []);

  const toggleExpand = async (idx, ingestionId) => {
    if (expandedIndex === idx) {
      setExpandedIndex(null);
      setDetail(null);
      return;
    }
    setExpandedIndex(idx);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/ingestions/${ingestionId}`);
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error("Errore dettaglio ingestion:", err);
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-brand">Storico Ingestion</h1>

      {ingestions.length === 0 ? (
        <p className="text-gray-600">Nessuna ingestion trovata.</p>
      ) : (
        <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
          <table className="min-w-full text-sm text-left border-collapse">
            <thead className="bg-brand text-white">
              <tr>
                <th className="px-4 py-2">Ingestion #</th>
                <th className="px-4 py-2">Data/Ora</th>
                <th className="px-4 py-2">Totale EAN</th>
                <th className="px-4 py-2">Stato DDS TRADER</th>
                <th className="px-4 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {ingestions.map((ing, idx) => (
                <>
                  <tr
                    key={ing.internalReferenceNumber}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2 border-t font-mono">
                      {ing.internalReferenceNumber}
                    </td>
                    <td className="px-4 py-2 border-t">
                      {new Date(ing.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border-t">{ing.totalEAN}</td>
                    <td className="px-4 py-2 border-t">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          ing.ddsTraderStatus === "SUBMITTED"
                            ? "bg-yellow-100 text-yellow-800"
                            : ing.ddsTraderStatus === "VALID"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {ing.ddsTraderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 border-t">
                      <button
                        onClick={() => toggleExpand(idx, ing.internalReferenceNumber)}
                        className="text-brand hover:underline"
                      >
                        {expandedIndex === idx ? "Nascondi" : "Dettagli"}
                      </button>
                    </td>
                  </tr>

                  {expandedIndex === idx && (
                    <tr>
                      <td colSpan="5" className="p-4 bg-gray-50 border-t">
                        {loadingDetail ? (
                          <p className="text-gray-500">Caricamento dettagli…</p>
                        ) : detail ? (
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">
                              DDS TRADER
                            </h3>
                            <pre className="bg-white p-2 mb-4 text-xs border">
                              {JSON.stringify(detail.ddsTrader, null, 2)}
                            </pre>

                            <h3 className="font-semibold text-gray-700 mb-2">
                              DDS Fornitore
                            </h3>
                            {detail.ddsFornitore.length > 0 ? (
                              <table className="w-full text-xs border border-gray-200 rounded mb-4">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-2 py-1 border">Reference</th>
                                    <th className="px-2 py-1 border">Verification</th>
                                    <th className="px-2 py-1 border">Stato</th>
                                    <th className="px-2 py-1 border">EAN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.ddsFornitore.map((d, j) => (
                                    <tr
                                      key={j}
                                      className="odd:bg-white even:bg-gray-50"
                                    >
                                      <td className="px-2 py-1 border">{d.referenceNumber}</td>
                                      <td className="px-2 py-1 border">{d.verificationNumber}</td>
                                      <td
                                        className={`px-2 py-1 border font-medium ${
                                          d.status === "VALID"
                                            ? "text-green-700"
                                            : d.statusDetail === "NOT_FOUND"
                                            ? "text-red-700"
                                            : "text-gray-700"
                                        }`}
                                      >
                                        {d.status}
                                        {d.statusDetail ? ` (${d.statusDetail})` : ""}
                                      </td>
                                      <td className="px-2 py-1 border">
                                        {d.eanList?.join(", ")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-gray-500 text-sm">
                                Nessuna DDS fornitore salvata.
                              </p>
                            )}

                            <h3 className="font-semibold text-gray-700 mb-2">
                              EAN associati
                            </h3>
                            <ul className="list-disc list-inside text-sm">
                              {detail.eanList.map((e, i) => (
                                <li key={i}>{e.ean}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-red-500">Errore caricamento dettaglio.</p>
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
*/

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

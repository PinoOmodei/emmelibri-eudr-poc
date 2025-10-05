import { useEffect, useState } from "react";

export default function RecordsPage() {
  const [ingestions, setIngestions] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshIngestions();
  }, []);

  const refreshIngestions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingestions");
      const data = await res.json();
      setIngestions(data);
    } catch (err) {
      console.error("Errore aggiornamento storico:", err);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand">Storico Ingestion</h1>
        <button
          onClick={refreshIngestions}
          className="bg-brand text-white text-sm px-3 py-1 rounded hover:bg-brand-dark"
        >
          🔄 {loading ? "Aggiornamento..." : "Refresh"}
        </button>
      </div>
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
                    className={`
                      ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      ${ing.ddsTraderStatus?.includes("In attesa") ? "opacity-80" : ""}
                    `}
                  >
                    <td className="px-4 py-2 border-t font-mono">
                      {ing.ddsIdentifier
                        ? ing.ddsIdentifier
                        : ing.internalReferenceNumber}
                    </td>

                    <td className="px-4 py-2 border-t">
                      {new Date(ing.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 border-t">{ing.totalEAN}</td>
                    <td className="px-4 py-2 border-t">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${ing.ddsTraderStatus?.includes("In attesa")
                          ? "bg-yellow-100 text-yellow-800"
                          : ing.ddsTraderStatus?.toUpperCase().includes("VALID")
                            ? "bg-green-100 text-green-800"
                            : ing.ddsTraderStatus?.toUpperCase().includes("SUBMITTED")
                              ? "bg-yellow-100 text-yellow-800"
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
                  </tr >

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
                            <table className="text-xs mb-4 border border-gray-200 rounded w-full">
                              <tbody>
                                <tr>
                                  <td className="px-2 py-1 border font-medium text-gray-600 w-40">UUID</td>
                                  <td className="px-2 py-1 border">{detail.ddsTrader.ddsIdentifier || "—"}</td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1 border font-medium text-gray-600">Reference</td>
                                  <td className="px-2 py-1 border">
                                    {detail.ddsTrader.referenceNumber || (
                                      <span className="text-yellow-700">In attesa codici TRACES</span>
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1 border font-medium text-gray-600">Verification</td>
                                  <td className="px-2 py-1 border">
                                    {detail.ddsTrader.verificationNumber || (
                                      <span className="text-yellow-700">—</span>
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="px-2 py-1 border font-medium text-gray-600">Stato</td>
                                  <td className="px-2 py-1 border">
                                    {detail.ddsTrader.status || "UNKNOWN"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>

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
                                        className={`px-2 py-1 border font-medium ${d.status === "VALID"
                                          ? "text-green-700"
                                          : "text-red-700"
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
                            <table className="w-full text-xs border border-gray-200 rounded mb-4">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-2 py-1 border">EAN</th>
                                  <th className="px-2 py-1 border">DDS Associati</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.eanList.map((e, i) => {
                                  // Trova i DDS che includono questo EAN
                                  const associatedDDS = detail.ddsFornitore.filter(d =>
                                    d.eanList.includes(e.ean)
                                  );

                                  // Colore condizionale
                                  const allValid = associatedDDS.length > 0 && associatedDDS.every(d => d.status === "VALID");
                                  const noneValid = associatedDDS.length > 0 && associatedDDS.every(d => d.status !== "VALID");
                                  const rowClass = allValid
                                    ? "text-green-700"
                                    : noneValid
                                      ? "text-red-700"
                                      : "text-yellow-700";

                                  return (
                                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                                      <td className={`px-2 py-1 border font-medium ${rowClass}`}>
                                        {e.ean}
                                      </td>
                                      <td className="px-2 py-1 border">
                                        {associatedDDS.length > 0 ? (
                                          associatedDDS.map((d, j) => (
                                            <span
                                              key={j}
                                              className={`mr-2 ${d.status === "VALID"
                                                ? "text-green-700"
                                                : "text-red-700"
                                                }`}
                                            >
                                              {d.referenceNumber}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-red-700">Nessuna DDS</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
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
      )
      }
    </div >
  );
}

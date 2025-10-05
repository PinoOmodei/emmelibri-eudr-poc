import { useState } from "react";

export default function IngestPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // 🔹 campi costanti
  const [operatorId, setOperatorId] = useState("OP-EMMELIBRI");
  const [operatorName, setOperatorName] = useState("Emmelibri S.p.A.");
  const [role, setRole] = useState("TRADER");
  const [productId, setProductId] = useState("490199");
  const [productName, setProductName] = useState("Books");

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpload = async () => {
    if (!file) {
      showToast("Nessun file selezionato", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("operatorId", operatorId);
    formData.append("operatorName", operatorName);
    formData.append("role", role);
    formData.append("productId", productId);
    formData.append("productName", productName);

    setLoading(true);
    setResult(null);

    try {
      // 🔹 ora puntiamo al nuovo endpoint ingest
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Errore ingest");
      }

      const data = await res.json();
      setResult(data);

      const ref = data.traderDDS?.ddsIdentifier || "N/D";
      showToast(`Ingest completata – DDS Trader ${ref} salvata`, "success");
    } catch (err) {
      setResult({ error: err.message });
      showToast("Errore ingest: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ingest DDS da CSV</h1>

      {/* 🔹 form dati costanti */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder="Operator ID" />
        <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Operator Name" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
        <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Product ID" />
        <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product Name" />
      </div>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
        className="mb-4"
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Caricamento..." : "Avvia ingest"}
      </button>

      {toast && (
        <div className={`mt-4 p-2 ${toast.type === "error" ? "bg-red-200" : "bg-green-200"}`}>
          {toast.msg}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="font-bold">Esito ingest</h2>

          {/* 🔹 Riepilogo */}
          {result.summary && (
            <div className="mt-2 bg-gray-100 p-2 rounded">
              <p><strong>Totale DDS:</strong> {result.summary.totalDDS}</p>
              <p><strong>Validi:</strong> {result.summary.valid}</p>
              <p><strong>Invalidi:</strong> {result.summary.invalid}</p>
              {result.summary.invalid_not_found > 0 && (
                <p className="text-red-600">
                  ⚠️ {result.summary.invalid_not_found} DDS non trovati in TRACES
                </p>
              )}
            </div>
          )}

          {/* 🔹 JSON completo (debug) */}
          <pre className="mt-4 bg-gray-100 p-2 text-sm">
            {JSON.stringify(result.ingestion, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


/*import { useState } from "react";

export default function IngestPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // 🔹 nuovi campi costanti
  const [operatorId, setOperatorId] = useState("OP-EMMELIBRI");
  const [operatorName, setOperatorName] = useState("Emmelibri S.p.A.");
  const [role, setRole] = useState("TRADER");
  const [productId, setProductId] = useState("490199");
  const [productName, setProductName] = useState("Books");

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpload = async () => {
    if (!file) {
      showToast("Nessun file selezionato", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // 🔹 aggiunta campi costanti nel formData
    formData.append("operatorId", operatorId);
    formData.append("operatorName", operatorName);
    formData.append("role", role);
    formData.append("productId", productId);
    formData.append("productName", productName);

    setLoading(true);
    setResult(null);

    try {
      // 🔹 endpoint REST resta invariato
      const res = await fetch("/api/pipeline", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Errore pipeline");
      }

      const data = await res.json();
      setResult(data);

      const traderRef = data.ddsTrader?.referenceNumber || "N/D";
      showToast(`Pipeline completata – DDS TRADER ${traderRef} creato`, "success");
    } catch (err) {
      setResult({ error: err.message });
      showToast("Errore pipeline: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ingest DDS da CSV</h1>

      // 🔹 form dati costanti
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input value={operatorId} onChange={(e) => setOperatorId(e.target.value)} placeholder="Operator ID" />
        <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Operator Name" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
        <input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Product ID" />
        <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product Name" />
      </div>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
        className="mb-4"
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Caricamento..." : "Avvia ingest"}
      </button>

      {toast && (
        <div className={`mt-4 p-2 ${toast.type === "error" ? "bg-red-200" : "bg-green-200"}`}>
          {toast.msg}
        </div>
      )}

      {result && (
        <pre className="mt-4 bg-gray-100 p-2 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
*/
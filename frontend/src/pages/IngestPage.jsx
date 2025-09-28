import { useState } from "react";

export default function IngestPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      showToast("Nessun file selezionato", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setResult(null);

    try {
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

      const traderRef = data.traderDDS?.referenceNumber || "N/D";
      showToast(`Pipeline completata – DDS TRADER ${traderRef} creata`, "success");
    } catch (err) {
      setResult({ error: err.message });
      showToast("Errore pipeline: " + err.message, "error");
    } finally {
      // Ritardo per simulare "processing"
      // setLoading(false)
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="max-w-3xl mx-auto relative">
      <h1 className="text-2xl font-bold mb-6 text-brand">
        Ingestione CSV & Pipeline
      </h1>

      <div className="flex items-center gap-4 mb-6">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`px-5 py-2 rounded-lg text-white transition-colors duration-200 ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-brand hover:bg-brand-dark"
          }`}
        >
          {loading ? "Elaborazione..." : "Carica e processa"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-brand mb-4">
          <svg
            className="animate-spin h-5 w-5 text-brand"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <span>Elaborazione pipeline in corso...</span>
        </div>
      )}

      {result && (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Risultato</h2>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-2 rounded-lg shadow-md animate-fade-in ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

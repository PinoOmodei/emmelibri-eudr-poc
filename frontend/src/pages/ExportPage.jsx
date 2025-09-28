import { useState } from "react";

export default function ExportPage() {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async (type) => {
    setLoading(true);
    try {
      // download diretto, niente fetch/json
      window.open(`/api/export/${type}`, "_blank");
      showToast(`Export ${type.toUpperCase()} avviato`);
    } catch (err) {
      showToast("Errore durante l'export: " + err.message);
    } finally {
      // Ritardo per simulare "processing"
      // setLoading(false)
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      showToast(data.message || "Reset completato");
    } catch (err) {
      showToast("Errore durante il reset del DB: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto relative">
      <h1 className="text-2xl font-bold mb-6 text-brand">Export per Clienti</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => handleExport("csv")}
          disabled={loading}
          className={`px-5 py-2 rounded-lg text-white transition-colors duration-200 ${loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700"
            }`}
        >
          {loading ? "Elaborazione..." : "Scarica CSV"}
        </button>
        <button
          onClick={() => handleExport("onix")}
          disabled={loading}
          className={`px-5 py-2 rounded-lg text-white transition-colors duration-200 ${loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700"
            }`}
        >
          {loading ? "Elaborazione..." : "Scarica ONIX (XML)"}
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className={`px-5 py-2 rounded-lg text-white transition-colors duration-200 ${loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-600 hover:bg-red-700"
            }`}
        >
          {loading ? "Elaborazione..." : "Reset DB"}
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
          <span>Elaborazione in corso...</span>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-md animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

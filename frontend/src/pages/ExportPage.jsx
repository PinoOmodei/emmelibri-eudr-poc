import { useState } from "react";

export default function ExportPage() {
  const [toast, setToast] = useState(null);

  const handleExport = (type) => {
    window.open(`/api/export/${type}`, "_blank");
  };

  const handleReset = async () => {
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      showToast(data.message || "Reset completato");
    } catch (err) {
      showToast("Errore durante il reset del DB: " + err.message);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000); // toast visibile per 3s
  };

  return (
    <div className="relative">
      <h1 className="text-xl font-bold mb-4">Export per Clienti</h1>
      <div className="flex gap-4">
        <button
          onClick={() => handleExport("csv")}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Scarica CSV
        </button>
        <button
          onClick={() => handleExport("onix")}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          Scarica ONIX (XML)
        </button>
      </div>

      <div className="mt-6">
        <button
          onClick={handleReset}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Reset DB
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}


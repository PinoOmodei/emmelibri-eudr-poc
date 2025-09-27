import { useState } from "react";

export default function IngestPage() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/pipeline", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setResult(data);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Ingestione CSV & Pipeline</h1>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} className="mb-2" />
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Carica e processa
      </button>

      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Risultato:</h2>
          <pre className="bg-gray-100 p-4 mt-2 rounded text-sm overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

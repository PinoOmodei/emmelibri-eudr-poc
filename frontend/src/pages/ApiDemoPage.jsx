import { useEffect, useState } from "react";

export default function ApiDemoPage() {
  const [eanList, setEanList] = useState([]);
  const [selectedEans, setSelectedEans] = useState([]);
  const [apiResponse, setApiResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔹 Recupera tutti gli EAN da tutte le ingestion
  useEffect(() => {
    fetch("/api/ingestions")
      .then((res) => res.json())
      .then(async (summaries) => {
        let allEans = new Set();

        for (const s of summaries) {
          const resDetail = await fetch(`/api/ingestions/${s.internalReferenceNumber}`);
          const detail = await resDetail.json();
          detail.eanList.forEach((e) => allEans.add(e.ean));
        }

        setEanList(Array.from(allEans));
      });
  }, []);

  // 🔹 Aggiungi o rimuovi EAN selezionato
  const toggleEan = (ean) => {
    setSelectedEans((prev) =>
      prev.includes(ean)
        ? prev.filter((x) => x !== ean)
        : [...prev, ean]
    );
  };

  // 🔹 Invia richiesta API con tutti gli EAN selezionati
  const handleSubmit = async () => {
    if (selectedEans.length === 0) {
      alert("⚠️ Seleziona almeno un EAN prima di procedere!");
      return;
    }

    setLoading(true);
    setApiResponse(null);

    try {
      const res = await fetch("/api/trader-dds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eans: selectedEans }),
      });
      const data = await res.json();
      setApiResponse(data);
    } catch (err) {
      console.error("❌ Errore API:", err);
      alert("Errore durante la chiamata API");
    } finally {
      setLoading(false);
    }
  };

  const requestExample =
    selectedEans.length > 0
      ? `POST /api/trader-dds
Content-Type: application/json

{
  "eans": ${JSON.stringify(selectedEans, null, 2)}
}`
      : "// Seleziona uno o più EAN per vedere l'esempio";

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-brand">Demo API Trader DDS</h1>
      <h4>
        Utile per esportare "al volo" le DDS abbinate agli EAN di un nostro DDT cliente.
      </h4>
      <hr className="my-4" />

      {/* === EAN disponibili === */}
      <div className="mb-4">
        <p className="mb-2 font-semibold">EAN disponibili:</p>
        <div className="flex flex-wrap gap-2">
          {eanList.map((ean, i) => (
            <button
              key={i}
              onClick={() => toggleEan(ean)}
              className={`px-3 py-1 border rounded transition-colors ${
                selectedEans.includes(ean)
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-brand border-brand hover:bg-brand/10"
              }`}
            >
              {ean}
            </button>
          ))}
        </div>
      </div>

      {/* === Pulsante di invio === */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`px-5 py-2 rounded mb-4 ${
          loading
            ? "bg-gray-400 text-gray-100 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {loading ? "⏳ Invio in corso..." : "🚀 Invia richiesta API"}
      </button>

      {/* === Richiesta API === */}
      <h3 className="font-semibold mb-2">Richiesta API</h3>
      <pre
        className="bg-black text-white font-normal font-mono p-4 rounded mb-4 text-sm cursor-pointer border border-gray-700"
        onClick={() => navigator.clipboard.writeText(requestExample)}
      >
        {requestExample}
      </pre>

      {/* === Risposta API === */}
      <h3 className="font-semibold mb-2">Risposta API</h3>
      <pre className="bg-black text-white font-normal font-mono p-4 rounded text-sm border border-gray-700 overflow-x-auto">
        {apiResponse
          ? JSON.stringify(apiResponse, null, 2)
          : "// In attesa di selezione e invio"}
      </pre>
    </div>
  );
}
import { useEffect, useState } from "react";

export default function ApiDemoPage() {
    const [eanList, setEanList] = useState([]);
    const [selectedEan, setSelectedEan] = useState(null);
    const [apiResponse, setApiResponse] = useState(null);

    useEffect(() => {
        fetch("/api/ingestions")
            .then((res) => res.json())
            .then(async (summaries) => {
                if (summaries.length > 0) {
                    const firstId = summaries[0].internalReferenceNumber;
                    const resDetail = await fetch(`/api/ingestions/${firstId}`);
                    const detail = await resDetail.json();
                    setEanList(detail.eanList.map((e) => e.ean));
                }
            });
    }, []);

    const handleSelect = async (ean) => {
        setSelectedEan(ean);
        setApiResponse(null);
        try {
            const res = await fetch("/api/trader-dds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eans: [ean] }),
            });
            const data = await res.json();
            setApiResponse(data);
        } catch (err) {
            console.error("Errore API:", err);
        }
    };

    const requestExample = selectedEan
        ? `POST /api/trader-dds
Content-Type: application/json

{
  "eans": ["${selectedEan}"]
}`
        : "// Seleziona un EAN per vedere l'esempio";

    return (
        <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-brand">Demo API Trader DDS</h1>
            <h4>Utile per esportare "al volo" le DDS abbinate agli EAN di un nostro DDT Ciente</h4>
            <p>-----------</p>
            <div className="mb-4">
                <p className="mb-2">EAN disponibili:</p>
                <div className="flex flex-wrap gap-2">
                    {eanList.map((ean, i) => (
                        <button
                            key={i}
                            onClick={() => handleSelect(ean)}
                            className={`px-3 py-1 border rounded ${selectedEan === ean ? "bg-brand text-white" : "bg-white text-brand"
                                }`}
                        >
                            {ean}
                        </button>
                    ))}
                </div>
            </div>

            <h3 className="font-semibold mb-2">Richiesta API</h3>
            
            <pre
                className="bg-black text-white font-normal font-mono p-4 rounded mb-4 text-sm cursor-pointer border border-gray-700"
                onClick={() => navigator.clipboard.writeText(requestExample)}
            >
                {requestExample}
            </pre>

            {/* Riquadro risposta */}
            <h3 className="font-semibold mb-2">Risposta API</h3>
            <pre className="bg-black text-white font-normal font-mono p-4 rounded text-sm border border-gray-700 overflow-x-auto">
                {apiResponse ? JSON.stringify(apiResponse, null, 2) : "// In attesa di selezione"}
            </pre>

        </div>
    );
}
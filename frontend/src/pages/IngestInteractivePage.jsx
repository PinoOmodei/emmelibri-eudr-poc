import { useState, useEffect } from "react";

export default function IngestInteractivePage() {
    const [ddsList, setDdsList] = useState([]);
    const [eanRows, setEanRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showJson, setShowJson] = useState(false);
    const [showDDS, setShowDDS] = useState(true);

    // 🔹 Carica DDS da TRACES
    const loadFromTraces = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/traces/ml-edit");
            if (!res.ok) throw new Error("Errore nel caricamento da TRACES");
            const data = await res.json();

            // Ordina per Internal Reference
            const sorted = [...data].sort((a, b) =>
                a.internalReferenceNumber.localeCompare(b.internalReferenceNumber)
            );
            setDdsList(sorted);
        } catch (err) {
            console.error("Errore caricamento DDS fornitore da TRACES:", err);
            setError("Impossibile recuperare le DDS ML-EDIT da TRACES");
            setDdsList([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFromTraces();
    }, []);

    // 🔹 Aggiungi / Rimuovi EAN
    const addEanRow = () => {
        setEanRows([...eanRows, { ean: "", copies: "", selectedDDS: [] }]);
    };
    const removeEanRow = (index) => {
        setEanRows(eanRows.filter((_, i) => i !== index));
    };

    // 🔹 Aggiorna campi
    const updateField = (index, field, value) => {
        const updated = [...eanRows];
        updated[index][field] = value;
        setEanRows(updated);
    };

    // 🔹 Seleziona DDS dal menu
    const handleDDSSelect = (rowIndex, ddsRef) => {
        const selectedDDSObj = ddsList.find(
            (d) => d.internalReferenceNumber === ddsRef
        );
        if (!selectedDDSObj) return;
        // Evita di selezionare DDS incomplete
        // Permetti sempre la selezione, anche se incompleta
        if (!selectedDDSObj.referenceNumber || !selectedDDSObj.verificationNumber) {
            console.warn(`⚠️ DDS ${ddsRef} incompleta, ma selezionata per test`);
        }

        const updated = [...eanRows];
        const current = updated[rowIndex].selectedDDS || [];
        if (!current.find((c) => c.internalReferenceNumber === ddsRef)) {
            updated[rowIndex].selectedDDS = [...current, selectedDDSObj];
            setEanRows(updated);
        }
    };

    // 🔹 Rimuovi DDS da una riga
    const removeDDS = (rowIndex, ddsRef) => {
        const updated = [...eanRows];
        updated[rowIndex].selectedDDS = updated[rowIndex].selectedDDS.filter(
            (d) => d.internalReferenceNumber !== ddsRef
        );
        setEanRows(updated);
    };

    // 🔹 Costruisci JSON di anteprima
    const buildPreviewJSON = () => {
        const eanList = eanRows
            .filter((r) => r.ean)
            .map((r) => ({
                ean: r.ean,
                hasValidDDS: r.selectedDDS.length > 0,
            }));

        const ddsFornitore = ddsList
            .filter((d) =>
                eanRows.some((r) =>
                    (r.selectedDDS || []).some(
                        (sel) => sel.internalReferenceNumber === d.internalReferenceNumber
                    )
                )
            )
            .map((d) => ({
                referenceNumber: d.referenceNumber,
                verificationNumber: d.verificationNumber,
                status: d.status,
                quantity: eanRows
                    .filter((r) =>
                        (r.selectedDDS || []).some(
                            (sel) => sel.internalReferenceNumber === d.internalReferenceNumber
                        )
                    )
                    .reduce((sum, r) => sum + (Number(r.copies) || 0), 0),
                eanList: eanRows
                    .filter((r) =>
                        (r.selectedDDS || []).some(
                            (sel) => sel.internalReferenceNumber === d.internalReferenceNumber
                        )
                    )
                    .map((r) => r.ean),
            }));

        return { ddsFornitore, eanList, source: "TRACES" };
    };

    // 🔹 Submit ingest TRADER (con feedback utente)
    const handleSubmit = async () => {
        const payload = buildPreviewJSON();
        setLoading(true);
        document.body.style.cursor = "wait"; // ⏳ cambia puntatore
        try {
            const res = await fetch("/api/ingest/traces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let backendError = "Errore sconosciuto dal backend";
                try {
                    const errData = await res.json();
                    backendError = errData.error || backendError;
                } catch {
                    backendError = `${res.status} ${res.statusText}`;
                }
                throw new Error(backendError);
            }

            const data = await res.json();
            alert(`✅ DDS TRADER creata!\n\n${data.message || ""}`);
        } catch (err) {
            console.error("❌ Errore durante l'ingest:", err);
            alert(`❌ Errore durante l'invio al backend:\n\n${err.message}`);
        } finally {
            setLoading(false);
            document.body.style.cursor = "default"; // 🔚 ripristina cursore
        }
    };

    // 🔹 Reset
    const handleReset = () => {
        setEanRows([]);
        setShowJson(false);
    };

    const previewJSON = buildPreviewJSON();

    return (
        <div className="p-6 space-y-8">
            <h1 className="text-2xl font-bold text-brand mb-4">
                Ingest Interattiva (EAN → DDS)
            </h1>

            {/* === Tabella EAN === */}
            <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-2 border min-w-[18ch]">EAN</th>
                            <th className="px-3 py-2 border text-center w-24">Copie</th>
                            <th className="px-3 py-2 border">DDS associati</th>
                            <th className="px-3 py-2 border text-center w-48">
                                Seleziona DDS
                            </th>
                            <th className="px-3 py-2 border text-center w-16">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {eanRows.map((row, idx) => (
                            <tr
                                key={idx}
                                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                                <td className="px-3 py-2 border">
                                    <input
                                        type="text"
                                        value={row.ean}
                                        onChange={(e) =>
                                            updateField(idx, "ean", e.target.value)
                                        }
                                        className="border px-2 py-1 rounded font-mono w-full"
                                        placeholder="EAN"
                                        maxLength={13}
                                        style={{ minWidth: "18ch" }}
                                    />
                                </td>
                                <td className="px-3 py-2 border text-center">
                                    <input
                                        type="number"
                                        value={row.copies}
                                        onChange={(e) =>
                                            updateField(idx, "copies", e.target.value)
                                        }
                                        className="border px-2 py-1 rounded w-20 text-center"
                                        placeholder="Copie"
                                    />
                                </td>

                                {/* === DDS associati === */}
                                <td className="px-3 py-2 border">
                                    <div className="flex flex-wrap gap-2">
                                        {row.selectedDDS?.length > 0 ? (
                                            row.selectedDDS.map((d) => (
                                                <span
                                                    key={d.internalReferenceNumber}
                                                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${!d.referenceNumber || !d.verificationNumber
                                                        ? "bg-orange-100 text-orange-800"
                                                        : d.status === "AVAILABLE"
                                                            ? "bg-green-100 text-green-800"
                                                            : d.status === "SUBMITTED"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-gray-200 text-gray-700"
                                                        }`}
                                                    title={`Reference: ${d.referenceNumber || "—"
                                                        }\nVerification: ${d.verificationNumber || "—"}`}
                                                    onClick={() =>
                                                        removeDDS(idx, d.internalReferenceNumber)
                                                    }
                                                >
                                                    {d.internalReferenceNumber}
                                                    {!d.referenceNumber || !d.verificationNumber
                                                        ? " ⚠️"
                                                        : ""}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-400 text-xs">
                                                Nessuna DDS selezionata
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* === Menu DDS === */}
                                <td className="px-3 py-2 border text-center">
                                    <select
                                        onChange={(e) => handleDDSSelect(idx, e.target.value)}
                                        className="border rounded px-2 py-1 text-sm w-full"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>
                                            — Seleziona —
                                        </option>
                                        {ddsList.map((d, i) => (
                                            <option
                                                key={i}
                                                value={d.internalReferenceNumber}
                                                className="font-mono"
                                            >
                                                {d.internalReferenceNumber} ({d.status})
                                                {!d.referenceNumber || !d.verificationNumber
                                                    ? " ⚠️"
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </td>

                                {/* === Azioni === */}
                                <td className="px-3 py-2 border text-center">
                                    <button
                                        onClick={() => removeEanRow(idx)}
                                        className="text-brand hover:underline"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* === Pulsante Aggiungi EAN === */}
            <button
                onClick={addEanRow}
                className="mt-3 bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark"
            >
                ➕ Aggiungi EAN
            </button>

            {/* === Tabella DDS TRACES === */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold text-brand">
                        DDS Fornitore (ML-EDIT) da TRACES
                    </h2>
                    <button
                        onClick={() => setShowDDS(!showDDS)}
                        className="text-sm text-brand underline hover:text-brand-dark"
                    >
                        {showDDS ? "Nascondi DDS ▲" : "Mostra DDS ▼"}
                    </button>
                </div>
                {showDDS && (
                    <>
                        {loading ? (
                            <p className="text-gray-600">Caricamento DDS da TRACES…</p>
                        ) : error ? (
                            <p className="text-red-600">{error}</p>
                        ) : (
                            <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
                                <table className="min-w-full text-sm text-left border-collapse">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-2 py-1 border">Internal Ref</th>
                                            <th className="px-2 py-1 border">Reference</th>
                                            <th className="px-2 py-1 border">Verification</th>
                                            <th className="px-2 py-1 border">Stato</th>
                                            <th className="px-2 py-1 border">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ddsList.map((d, idx) => (
                                            <tr
                                                key={idx}
                                                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                            >
                                                <td className="px-2 py-1 border font-mono">
                                                    {d.internalReferenceNumber}
                                                </td>
                                                <td className="px-2 py-1 border font-mono">
                                                    {d.referenceNumber || "—"}
                                                </td>
                                                <td className="px-2 py-1 border font-mono">
                                                    {d.verificationNumber || "—"}
                                                </td>
                                                <td className="px-2 py-1 border text-center">
                                                    <span
                                                        className={`px-2 py-1 rounded text-xs font-medium ${!d.referenceNumber || !d.verificationNumber
                                                            ? "bg-orange-100 text-orange-800"
                                                            : d.status === "AVAILABLE"
                                                                ? "bg-green-100 text-green-800"
                                                                : d.status === "SUBMITTED"
                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                    : "bg-gray-100 text-gray-800"
                                                            }`}
                                                    >
                                                        {d.status || "UNKNOWN"}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1 border">
                                                    {d.date
                                                        ? new Date(d.date).toLocaleDateString("it-IT")
                                                        : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* === Anteprima JSON === */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-brand">Anteprima JSON</h3>
                    <button
                        onClick={() => setShowJson(!showJson)}
                        className="text-sm text-brand underline hover:text-brand-dark"
                    >
                        {showJson ? "Nascondi JSON ▲" : "Vedi JSON ▼"}
                    </button>
                </div>

                {showJson && (
                    <pre className="bg-gray-100 p-4 text-sm rounded border border-gray-300 overflow-auto max-h-80">
                        {JSON.stringify(previewJSON, null, 2)}
                    </pre>
                )}
            </section>

            {/* === Azioni finali === */}
            <section className="flex gap-4 items-center">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`px-6 py-2 rounded text-white flex items-center justify-center gap-2 ${loading
                            ? "bg-gray-400 cursor-wait"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                >
                    {loading ? (
                        <>
                            <span className="animate-spin border-2 border-t-transparent border-white rounded-full w-4 h-4"></span>
                            Ingest in corso…
                        </>
                    ) : (
                        <>🚀 Avvia ingest TRADER</>
                    )}
                </button>

                <button
                    onClick={handleReset}
                    disabled={loading}
                    className={`bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400 ${loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                >
                    🔄 Reset
                </button>
            </section>
        </div>
    );
}

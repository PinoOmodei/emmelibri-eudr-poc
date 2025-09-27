export default function ExportPage() {
  const handleExport = (type) => {
    window.open(`/api/export/${type}`, "_blank");
  };

  return (
    <div>
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
    </div>
  );
}

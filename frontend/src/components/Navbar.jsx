export default function Navbar({ onNavigate, current }) {
  const tabs = [
    { key: "ingest", label: "Ingest" },
    { key: "records", label: "Storico" },
    { key: "export", label: "Export" },
  ];

  return (
    <nav className="bg-blue-600 text-white p-4 flex gap-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onNavigate(tab.key)}
          className={`hover:underline ${current === tab.key ? "font-bold underline" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

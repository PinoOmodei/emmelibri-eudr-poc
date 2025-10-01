export default function Navbar({ onNavigate, current }) {
  const tabs = [
    { key: "ingest", label: "Ingest" },
    { key: "records", label: "Storico" },
    { key: "export", label: "Export" },
    { key: "api-demo", label: "Demo API" },
  ];

  return (
    <nav className="bg-brand text-white px-6 py-3 flex gap-8 shadow-md rounded-b-lg">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            console.log("Click tab:", tab.key); // 👈 log del click
            onNavigate(tab.key);
          }}
          className={`transition-colors duration-200 ${current === tab.key
            ? "font-semibold underline underline-offset-4"
            : "hover:text-gray-200"
            }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

import { useState } from "react";
import IngestPage from "./pages/IngestPage";
import RecordsPage from "./pages/RecordsPage";
import ExportPage from "./pages/ExportPage";
import Navbar from "./components/Navbar";

function App() {
  const [page, setPage] = useState("ingest");

  let content;
  switch (page) {
    case "records":
      content = <RecordsPage />;
      break;
    case "export":
      content = <ExportPage />;
      break;
    default:
      content = <IngestPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar onNavigate={setPage} current={page} />
      <div className="p-6">{content}</div>
    </div>
  );
}

export default App;

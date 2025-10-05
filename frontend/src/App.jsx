import { useState } from "react";
import IngestCsvPage from "./pages/IngestPage";
import IngestInteractivePage from "./pages/IngestInteractivePage";
import RecordsPage from "./pages/RecordsPage";
import ExportPage from "./pages/ExportPage";
import ApiDemoPage from "./pages/ApiDemoPage";
import Navbar from "./components/Navbar";
import OnixValidatorPage from "./pages/OnixValidatorPage";


function App() {
  const [page, setPage] = useState("ingest");
  console.log("Pagina corrente:", page);


  let content;
  switch (page) {
    case "ingest-csv":
      content = <IngestCsvPage />;
      break;
    case "records":
      content = <RecordsPage />;
      break;
    case "export":
      content = <ExportPage />;
      break;
    case "api-demo":
      content = <ApiDemoPage />;
      break;
    case "onix-validator":
      content = <OnixValidatorPage />;
      break;
    default:
      content = <IngestInteractivePage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar onNavigate={setPage} current={page} />
      <div className="p-6">{content}</div>
    </div>
  );
}

export default App;

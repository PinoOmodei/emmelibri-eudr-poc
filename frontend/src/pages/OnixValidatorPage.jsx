import React, { useState } from "react";

export default function OnixValidatorPage() {
  const [errors, setErrors] = useState([]);
  const [products, setProducts] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 🔎 chiamata al backend
      const response = await fetch("http://localhost:4000/api/validate-onix", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.valid) {
        setErrors(result.errors || ["Errore di validazione sconosciuto"]);
        setProducts([]);
        return;
      }

      // ✅ Se valido → parsing del file lato browser
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const productNodes = xmlDoc.getElementsByTagName("Product");

      const parsed = [];
      for (let i = 0; i < productNodes.length; i++) {
        const p = productNodes[i];

        // ISBN
        const isbn = [...p.getElementsByTagName("ProductIdentifier")]
          .map(pi => {
            const type = pi.getElementsByTagName("ProductIDType")[0]?.textContent;
            const val = pi.getElementsByTagName("IDValue")[0]?.textContent;
            return type === "15" ? val : null;
          })
          .filter(Boolean)[0] || "";

        // Titolo
        const title = p.getElementsByTagName("TitleText")[0]?.textContent || "";

        // Autore
        const author = [...p.getElementsByTagName("Contributor")]
          .map(c => {
            const role = c.getElementsByTagName("ContributorRole")[0]?.textContent;
            if (role === "A01") {
              return c.getElementsByTagName("PersonName")[0]?.textContent;
            }
            return null;
          })
          .filter(Boolean)[0] || "";

        // Numero pagine
        const pages = [...p.getElementsByTagName("Extent")]
          .map(ex => {
            const type = ex.getElementsByTagName("ExtentType")[0]?.textContent;
            if (type === "11") {
              return ex.getElementsByTagName("ExtentValue")[0]?.textContent;
            }
            return null;
          })
          .filter(Boolean)[0] || "";

        // Subject
        const subject = p.getElementsByTagName("SubjectCode")[0]?.textContent || "";

        // Imprint
        const imprint = p.getElementsByTagName("ImprintName")[0]?.textContent || "";

        // Publisher
        const publisher = p.getElementsByTagName("PublisherName")[0]?.textContent || "";

        // Publishing date
        const pubDate = [...p.getElementsByTagName("PublishingDate")]
          .map(pd => {
            const role = pd.getElementsByTagName("PublishingDateRole")[0]?.textContent;
            if (role === "01") {
              return pd.getElementsByTagName("Date")[0]?.textContent;
            }
            return null;
          })
          .filter(Boolean)[0] || "";

        // DDSInfo
        const ddsNodes = p.getElementsByTagNameNS("http://www.emmelibri.it/eudr", "DDSInfo");
        const ddsList = [];
        for (let j = 0; j < ddsNodes.length; j++) {
          const ref = ddsNodes[j].getElementsByTagNameNS("http://www.emmelibri.it/eudr", "ReferenceNumber")[0]?.textContent;
          const ver = ddsNodes[j].getElementsByTagNameNS("http://www.emmelibri.it/eudr", "VerificationNumber")[0]?.textContent;
          ddsList.push(`${ref} / ${ver}`);
        }

        parsed.push({ title, isbn, author, pages, subject, imprint, publisher, pubDate, ddsList });
      }

      setErrors([]);
      setProducts(parsed);

    } catch (err) {
      setErrors([`Errore validazione: ${err.message}`]);
      setProducts([]);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Validatore ONIX + EUDR</h1>
      <input type="file" accept=".xml,.onix" onChange={handleFile} />

      {errors.length > 0 && (
        <div className="text-red-600 mt-4">
          <h2 className="font-semibold">Errori di validazione:</h2>
          <ul className="list-disc ml-6">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {products.length > 0 && (
        <table className="mt-6 border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2">Titolo</th>
              <th className="px-3 py-2">ISBN</th>
              <th className="px-3 py-2">Autore</th>
              <th className="px-3 py-2">Pagine</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Imprint</th>
              <th className="px-3 py-2">Publisher</th>
              <th className="px-3 py-2">Data Pubblicazione</th>
              <th className="px-3 py-2">DDS Info</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i}>
                <td className="border px-3 py-2">{p.title}</td>
                <td className="border px-3 py-2">{p.isbn}</td>
                <td className="border px-3 py-2">{p.author}</td>
                <td className="border px-3 py-2">{p.pages}</td>
                <td className="border px-3 py-2">{p.subject}</td>
                <td className="border px-3 py-2">{p.imprint}</td>
                <td className="border px-3 py-2">{p.publisher}</td>
                <td className="border px-3 py-2">{p.pubDate}</td>
                <td className="border px-3 py-2">
                  <ul className="list-disc ml-4">
                    {p.ddsList.map((d, idx) => <li key={idx}>{d}</li>)}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

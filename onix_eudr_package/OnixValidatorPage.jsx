import React, { useState } from "react";
import { validateXML } from "xmllint-wasm";

export default function OnixValidatorPage() {
  const [errors, setErrors] = useState([]);
  const [products, setProducts] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();

    // Carica gli XSD dal public/schemas/
    const onixXsd = await fetch("/schemas/onix-main.xsd").then(r => r.text());
    const eudrXsd = await fetch("/schemas/eudr-extension.xsd").then(r => r.text());

    try {
      const result = await validateXML({ xml: text, schema: [onixXsd, eudrXsd] });

      if (result.errors && result.errors.length > 0) {
        setErrors(result.errors);
        setProducts([]);
        return;
      }

      // Parsing prodotti
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const productNodes = xmlDoc.getElementsByTagName("Product");

      const parsed = [];
      for (let i = 0; i < productNodes.length; i++) {
        const p = productNodes[i];
        parsed.push({
          title: p.querySelector("TitleText")?.textContent || "",
          refNum: p.querySelector("eudr\\:ReferenceNumber")?.textContent || "",
          verNum: p.querySelector("eudr\\:VerificationNumber")?.textContent || ""
        });
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
          <h2>Errori di validazione:</h2>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {products.length > 0 && (
        <table className="mt-6 border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">Titolo</th>
              <th className="px-4 py-2">ReferenceNumber</th>
              <th className="px-4 py-2">VerificationNumber</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i}>
                <td className="border px-4 py-2">{p.title}</td>
                <td className="border px-4 py-2">{p.refNum}</td>
                <td className="border px-4 py-2">{p.verNum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

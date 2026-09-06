const [major] = process.versions.node.split(".").map(Number);

if (major !== 24) {
  throw new Error(
    `Ten projekt wymaga Node.js 24 LTS do buildu (aktywny: ${process.versions.node}). ` +
      "Uruchom polecenie w Node 24 lub przez obraz Docker.",
  );
}

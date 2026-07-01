export default async function handler(req, res) {
  const code = (req.query.code || "").trim();
  if (!/^\d{4,6}$/.test(code)) {
    res.status(400).json({ error: "invalid code" });
    return;
  }

  async function tryTwse(market) {
    try {
      const url = `https://mis.tse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${code}.tw&json=1&delay=0`;
      const r = await fetch(url, {
        headers: { "Referer": "https://mis.tse.com.tw/", "User-Agent": "Mozilla/5.0" }
      });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.msgArray || !j.msgArray.length) return null;
      const d = j.msgArray[0];
      let z = d.z;
      if (!z || z === "-") z = d.y;
      const price = parseFloat(z);
      if (isNaN(price)) return null;
      return { price: price, name: d.n || null };
    } catch (e) {
      return null;
    }
  }

  async function tryYahoo(suffix) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}${suffix}?interval=1d&range=1d`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return null;
      const j = await r.json();
      const result = j && j.chart && j.chart.result && j.chart.result[0];
      const meta = result && result.meta;
      const price = meta && (meta.regularMarketPrice != null ? meta.regularMarketPrice : meta.previousClose);
      if (price == null || isNaN(price)) return null;
      return { price: price, name: meta.shortName || null };
    } catch (e) {
      return null;
    }
  }

  let result = await tryTwse("tse");
  if (!result) result = await tryTwse("otc");
  if (!result) result = await tryYahoo(".TW");
  if (!result) result = await tryYahoo(".TWO");

  if (!result) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.status(200).json(result);
}

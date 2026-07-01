export default async function handler(req, res) {
  try {
    const r = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!r.ok) {
      res.status(502).json({ error: "upstream failed" });
      return;
    }
    const list = await r.json();
    if (!Array.isArray(list)) {
      res.status(502).json({ error: "bad upstream data" });
      return;
    }
    const simplified = list
      .filter(function (item) {
        return item && item.Code && item.Name && /^\d{4,6}$/.test(item.Code.trim());
      })
      .map(function (item) {
        return [item.Code.trim(), item.Name.trim()];
      });

    // 快取一小時，減少對證交所的重複請求
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(simplified);
  } catch (e) {
    res.status(500).json({ error: "fetch failed" });
  }
}

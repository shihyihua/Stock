export default async function handler(req, res) {
  const result = [];
  const seen = {};

  // 上市（TWSE）— 一般股票與上市 ETF
  try {
    const r = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list)) {
        list.forEach(function (item) {
          const code = item && item.Code ? item.Code.trim() : "";
          const name = item && item.Name ? item.Name.trim() : "";
          if (/^\d{4,6}[A-Za-z]?$/.test(code) && name && !seen[code]) {
            result.push([code, name]);
            seen[code] = true;
          }
        });
      }
    }
  } catch (e) { /* 上市清單失敗就略過，不影響上櫃 */ }

  // 上櫃（TPEx）— 實驗性來源，格式若異動會自動略過不影響其他資料
  try {
    const r2 = await fetch("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (r2.ok) {
      const list2 = await r2.json();
      if (Array.isArray(list2)) {
        list2.forEach(function (item) {
          const code = (item.SecuritiesCompanyCode || item.Code || item.CompanyId || "").toString().trim();
          const name = (item.CompanyName || item.Name || "").toString().trim();
          if (/^\d{4,6}[A-Za-z]?$/.test(code) && name && !seen[code]) {
            result.push([code, name]);
            seen[code] = true;
          }
        });
      }
    }
  } catch (e) { /* 上櫃來源失敗就略過 */ }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json(result);
}

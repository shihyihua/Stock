// 共用工具：Upstash Redis（REST API）與股票現價查詢
export const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
export const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCmd(parts) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Redis 環境變數未設定（KV_REST_API_URL / KV_REST_API_TOKEN）");
  }
  const url = REDIS_URL + "/" + parts.map((p) => encodeURIComponent(p)).join("/");
  const r = await fetch(url, { headers: { Authorization: "Bearer " + REDIS_TOKEN } });
  const j = await r.json();
  return j.result;
}

export async function redisGet(key) { return redisCmd(["get", key]); }
export async function redisSet(key, value) { return redisCmd(["set", key, value]); }
export async function redisSadd(setKey, member) { return redisCmd(["sadd", setKey, member]); }
export async function redisSmembers(setKey) { return redisCmd(["smembers", setKey]); }
export async function redisSrem(setKey, member) { return redisCmd(["srem", setKey, member]); }

export async function fetchStockPrice(code) {
  async function tryTwse(market) {
    try {
      const url = `https://mis.tse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${code}.tw&json=1&delay=0`;
      const r = await fetch(url, { headers: { Referer: "https://mis.tse.com.tw/", "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.msgArray || !j.msgArray.length) return null;
      const d = j.msgArray[0];
      let z = d.z;
      if (!z || z === "-") z = d.y;
      const price = parseFloat(z);
      if (isNaN(price)) return null;
      return { price, name: d.n || null };
    } catch (e) { return null; }
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
      return { price, name: meta.shortName || null };
    } catch (e) { return null; }
  }
  let result = await tryTwse("tse");
  if (!result) result = await tryTwse("otc");
  if (!result) result = await tryYahoo(".TW");
  if (!result) result = await tryYahoo(".TWO");
  return result;
}

export function computeStatusClass(cost, price) {
  if (cost == null || isNaN(cost) || price == null || isNaN(price)) return null;
  const pct = ((price - cost) / cost) * 100;
  let cls;
  if (pct >= 15) cls = "profit_strong";
  else if (pct >= 5) cls = "profit";
  else if (pct > -5) cls = "neutral";
  else if (pct > -10) cls = "loss";
  else cls = "loss_strong";
  return { cls, pct };
}

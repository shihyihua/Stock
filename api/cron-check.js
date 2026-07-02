import webpush from "web-push";
import { redisGet, redisSet, redisSmembers, redisSrem, fetchStockPrice, computeStatusClass } from "../lib/utils.js";

export default async function handler(req, res) {
  const key = req.query.key;
  if (!key || key !== process.env.CRON_SECRET_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    res.status(500).json({ error: "VAPID keys not configured" });
    return;
  }
  webpush.setVapidDetails("mailto:stockapp@example.com", VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    const deviceIds = (await redisSmembers("devices")) || [];
    const priceCache = {};
    let notifiedCount = 0;
    let checkedRows = 0;

    for (const deviceId of deviceIds) {
      const raw = await redisGet("device:" + deviceId);
      if (!raw) continue;
      let record;
      try { record = JSON.parse(raw); } catch (e) { continue; }
      if (!record.subscription) continue;

      const watchlist = record.watchlist || [];
      const notifiedState = record.notifiedState || {};
      let changed = false;

      for (const row of watchlist) {
        if (!row.code || row.costPrice === "" || row.costPrice == null) continue;
        checkedRows++;
        if (!(row.code in priceCache)) {
          priceCache[row.code] = await fetchStockPrice(row.code);
        }
        const priceInfo = priceCache[row.code];
        if (!priceInfo) continue;

        const statusResult = computeStatusClass(parseFloat(row.costPrice), priceInfo.price);
        if (!statusResult) continue;
        const { cls, pct } = statusResult;
        const prevCls = notifiedState[row.id];

        if ((cls === "profit_strong" || cls === "loss_strong") && prevCls !== cls) {
          const emoji = cls === "profit_strong" ? "🎉🚀" : "🚨✂️";
          const text = cls === "profit_strong" ? "大賺！可考慮獲利了結" : "建議停損囉";
          const payload = JSON.stringify({
            title: emoji + " 股票帶你飛提醒",
            body: (row.name || row.code) + "　" + text + "（" + (pct > 0 ? "+" : "") + pct.toFixed(1) + "%）"
          });
          try {
            await webpush.sendNotification(record.subscription, payload);
            notifiedCount++;
          } catch (pushErr) {
            if (pushErr && (pushErr.statusCode === 404 || pushErr.statusCode === 410)) {
              await redisSrem("devices", deviceId);
              record.subscription = null;
            }
          }
        }

        if (notifiedState[row.id] !== cls) {
          notifiedState[row.id] = cls;
          changed = true;
        }
      }

      if (changed || !record.subscription) {
        record.notifiedState = notifiedState;
        await redisSet("device:" + deviceId, JSON.stringify(record));
      }
    }

    res.status(200).json({ ok: true, devices: deviceIds.length, rowsChecked: checkedRows, notified: notifiedCount });
  } catch (e) {
    res.status(500).json({ error: "cron failed", detail: String(e && e.message || e) });
  }
}

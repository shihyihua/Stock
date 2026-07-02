import { redisSet, redisSadd } from "../lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const { deviceId, subscription, watchlist } = req.body || {};
    if (!deviceId || !subscription) {
      res.status(400).json({ error: "missing deviceId or subscription" });
      return;
    }
    const record = { subscription, watchlist: watchlist || [], notifiedState: {} };
    await redisSet("device:" + deviceId, JSON.stringify(record));
    await redisSadd("devices", deviceId);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "failed", detail: String(e && e.message || e) });
  }
}

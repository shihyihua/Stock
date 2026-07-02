import { redisGet, redisSet } from "../lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const { deviceId, watchlist } = req.body || {};
    if (!deviceId) {
      res.status(400).json({ error: "missing deviceId" });
      return;
    }
    const raw = await redisGet("device:" + deviceId);
    if (!raw) {
      res.status(404).json({ error: "device not registered, enable notifications first" });
      return;
    }
    const record = JSON.parse(raw);
    record.watchlist = watchlist || [];
    await redisSet("device:" + deviceId, JSON.stringify(record));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "failed", detail: String(e && e.message || e) });
  }
}

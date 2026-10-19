// Posts due reels from queue/queue.json to Instagram. Runs on GitHub Actions (see .github/workflows/post.yml).
// No dependencies: Node 20+ fetch.
// Secrets: IG_TOKEN (Instagram long-lived token), IG_USER_ID. Optional: IG_API_BASE (default graph.instagram.com, use
// https://graph.facebook.com for a Facebook-Login page token), IG_API_VERSION (default v23.0).
import { readFile, writeFile } from "node:fs/promises";

const QUEUE = "queue/queue.json";
const TOKEN = process.env.IG_TOKEN, USER = process.env.IG_USER_ID;
const BASE = (process.env.IG_API_BASE || "https://graph.instagram.com").replace(/\/$/, "") + "/" + (process.env.IG_API_VERSION || "v23.0");
const DRY = process.argv.includes("--dry");
const LATE_MS = 6 * 3600e3; // don't post anything more than 6h late; mark it missed instead

if (!DRY && (!TOKEN || !USER)) { console.error("Missing IG_TOKEN or IG_USER_ID secret."); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path, params = {}, method = "GET") {
  const u = new URL(BASE + path);
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = method === "GET" ? await fetch(u + "?" + body) : await fetch(u, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error((j.error && (j.error.error_user_msg || j.error.message)) || ("HTTP " + res.status));
  return j;
}

async function postReel(item) {
  // The video must be a public URL Instagram can download (a release asset of this public repo).
  const head = await fetch(item.video, { method: "HEAD", redirect: "follow" });
  if (!head.ok) throw new Error("Video URL not reachable (" + head.status + "): " + item.video);
  const trial = /trial/i.test(item.postAs || "");
  const params = { media_type: "REELS", video_url: item.video, caption: item.caption || "", share_to_feed: trial ? "false" : "true" };
  if (trial) params.trial_params = JSON.stringify({ graduation_strategy: item.graduation || "SS_PERFORMANCE" });
  if (item.coverAt != null) params.thumb_offset = String(Math.round(item.coverAt * 1000));
  const c = await api(`/${USER}/media`, params, "POST");
  // Wait for Instagram to finish processing the upload (usually 30-90s).
  let status = "IN_PROGRESS";
  for (let i = 0; i < 40 && status === "IN_PROGRESS"; i++) {
    await sleep(i < 3 ? 10e3 : 15e3);
    const s = await api(`/${c.id}`, { fields: "status_code,status" });
    status = s.status_code;
    if (status === "ERROR" || status === "EXPIRED") throw new Error("Instagram couldn't process the video: " + (s.status || status));
  }
  if (status !== "FINISHED") throw new Error("Instagram is still processing after 10 minutes; will retry next run.");
  const pub = await api(`/${USER}/media_publish`, { creation_id: c.id }, "POST");
  let permalink = "";
  try { permalink = (await api(`/${pub.id}`, { fields: "permalink" })).permalink || ""; } catch (e) {}
  return { mediaId: pub.id, permalink };
}

const queue = JSON.parse(await readFile(QUEUE, "utf8"));
const now = Date.now();
let changed = false;
for (const item of queue.items || []) {
  if (item.status !== "queued") continue;
  const at = Date.parse(item.at);
  if (!(at <= now)) continue;
  if (now - at > LATE_MS) { item.status = "missed"; item.error = "More than 6 hours late; not posted. Reschedule it in the studio."; changed = true; continue; }
  console.log(`Posting ${item.id} (${item.postAs || "Reel"}) due ${item.at}`);
  if (DRY) { console.log("  dry run, skipped"); continue; }
  item.tries = (item.tries || 0) + 1;
  try {
    const r = await postReel(item);
    Object.assign(item, { status: "posted", postedAt: new Date().toISOString(), error: null }, r);
    console.log("  posted", r.permalink || r.mediaId);
  } catch (e) {
    item.error = String(e.message || e);
    if (item.tries >= 3) item.status = "failed";
    console.error("  failed:", item.error);
  }
  changed = true;
  break; // one post per run keeps posts spaced and inside rate limits
}
if (changed) { queue.updatedAt = new Date().toISOString(); await writeFile(QUEUE, JSON.stringify(queue, null, 2) + "\n"); }

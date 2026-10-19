// Keeps the Instagram token alive. Long-lived Instagram-Login tokens last 60 days and can be refreshed once they are 24h old.
// With a GH_PAT secret (fine-grained, this repo only, "Secrets: read and write") the new token is saved back automatically.
const TOKEN = process.env.IG_TOKEN;
if (!TOKEN) { console.error("Missing IG_TOKEN"); process.exit(1); }
if ((process.env.IG_API_BASE || "").includes("facebook.com")) { console.log("Facebook-Login page tokens don't expire; nothing to do."); process.exit(0); }
const res = await fetch("https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=" + encodeURIComponent(TOKEN));
const j = await res.json();
if (!res.ok || !j.access_token) { console.error("Refresh failed:", JSON.stringify(j.error || j)); process.exit(1); }
console.log("Token refreshed; valid for", Math.round(j.expires_in / 86400), "days.");
const fs = await import("node:fs");
fs.writeFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `changed=${j.access_token !== TOKEN}\n`, { flag: "a" });
fs.writeFileSync(".new_token", j.access_token);

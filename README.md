# purefuel-poster

Posts PureFuel Alliance reels to Instagram (@purefuelalliance) at their scheduled times. Free: GitHub Actions + Instagram's own API.

**How it works.** The Content Studio (Claude) adds each scheduled reel to `queue/queue.json`, with the video uploaded as an asset of the `media` release. Every 15 minutes, `post.yml` posts whatever is due (one per run) as a Reel or Trial Reel, then writes the result back to the queue. Claude reads the results and marks the reels Posted in the studio.

Times in the queue are UTC. Anything more than 6 hours late is marked `missed`, not posted.

## One-time setup (Kai)
1. Instagram: @purefuelalliance must be a **Business or Creator** account.
2. developers.facebook.com → My Apps → Create app → type **Business** → add **Instagram** → "API setup with Instagram login".
   - Add @purefuelalliance under Roles → Instagram testers (accept the invite in the Instagram app → Settings → Website permissions / Apps and websites), or just "Generate token" for it in the Instagram product page.
   - Permissions needed: `instagram_business_basic`, `instagram_business_content_publish`.
   - Copy the **access token** and the **Instagram user ID** shown next to the account.
3. This repo → Settings → Secrets and variables → Actions → New repository secret:
   - `IG_TOKEN`: the token.
   - `IG_USER_ID`: the numeric ID.
   - (optional) `GH_PAT`: a fine-grained GitHub token for this repo only with "Secrets: read and write", so the weekly token refresh can save itself. Without it, paste a fresh `IG_TOKEN` every ~50 days.
4. Actions tab → enable workflows → "Post due reels" → Run workflow with **Dry run** checked to test.

The app can stay in development mode. It only posts to accounts that have a role on it, which is just yours.

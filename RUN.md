# RUN.md — what the owner has to do

The agent that built this repository cannot authenticate to GitHub, upload video, or submit on the
platform. Everything below is a human step. It should take about ten minutes.

**Deadline: Sep 25, 00:28 UTC — 07:28 WIB.**

---

## 0. Where things already stand

| Thing | Status |
|---|---|
| Public repo | **exists** — <https://github.com/valeemlbb-cell/hackalaunch-proof-of-taste> |
| Default branch | `main` (local `main` tracks `origin/main`) |
| GitHub Pages workflow | committed at `.github/workflows/pages.yml`, deploys on push to `main` |
| Live URL | <https://valeemlbb-cell.github.io/hackalaunch-proof-of-taste/> — **verify it loads** (step 2) |
| Video | `demo.mp4` at the root of this folder — **not uploaded yet** |

> **Do not create a second repository.** An earlier draft of this file told you to run
> `gh repo create warung-ops/receipt-first`. That instruction is wrong and has been removed: the
> remote above is the one the README, `SUBMISSION.md` and the live URL all point at. A second repo
> would split the history and break the Pages link.

## 1. Push the current commits to the existing remote

From `D:\warung-ops\hacka\proof-of-taste`:

```bash
gh auth login --web          # once, if `gh auth status` is not already green
git push -u origin main
```

If `git push` is rejected because the remote moved ahead, inspect before forcing:

```bash
git fetch origin && git log --oneline origin/main..HEAD HEAD..origin/main
```

## 2. Confirm GitHub Pages is on and the live link actually works

1. Repository → **Settings** → **Pages** → **Source: GitHub Actions**.
2. If the first push ran before you flipped that switch:
   `gh workflow run "Deploy to GitHub Pages"`.
3. Open <https://valeemlbb-cell.github.io/hackalaunch-proof-of-taste/> in a browser, connect a
   standard Solana wallet (or press **Use a devnet burner instead**), and check the footer prints
   the cluster. **Do not paste the link into the platform until it loads for you.**

The workflow runs `npm ci && npm test && npm run build` before deploying, so a red test suite
silently produces no live link. If Pages shows a 404, check the Actions tab first.

## 3. Upload the demo video

**`demo.mp4`** at the root of this folder is the one canonical cut — 1920×1080, 2 min 30 s, 14 MB.
The 720p file beside it is the *same cut*, re-encoded only to fit upload size limits; use it only if
the host rejects 14 MB. `demo/demo.mp4` is a byte-identical working copy — ignore it.

The videos are **not** committed (`.gitignore` excludes them), because the hackathon wants a link.

Upload unlisted to YouTube (or Loom / Vimeo / X) and keep the URL.

## 4. Paste the video URL into the two files that need it

- `SUBMISSION.md` → the **Demo video** line: replace `PASTE_VIDEO_URL_HERE`.
- `README.md` → the *Links* section: add the URL next to the demo-video bullet.

Then:

```bash
npm test && npm run build     # the Pages deploy gates on this
git commit -am "docs: add demo video link" && git push
```

## 5. Submit

Open <https://hackalaunch.com/h/proof-of-taste> and paste the submission text prepared for you in
the dashboard action `hacka-proof-of-taste` (Warung Ops dashboard → the button whose title starts
with the prize). It contains the description and the design statement; the three links are the repo
(step 1), the live app (step 2) and the video (step 3).

Payout address on file: `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q`.

---

## Strongly recommended: re-record the demo against real public devnet

This is the packet's weakest point. The recorded run used a local `solana-test-validator`, because
the public devnet faucet was rate-limiting this machine. The README and `SUBMISSION.md` say so
plainly and the app prints the real cluster on screen, so the video is honest — but the rules ask
for a transaction on a real network, and "non-functional demo" and "faked chain data" are on the
disqualifier list. An honest local-validator run is not faked data, but a genuine devnet run removes
the argument entirely during the 24-hour token-holder vote.

1. Get ~0.05 devnet SOL into a throwaway address at <https://faucet.solana.com> (GitHub login).
2. Put that keypair's base58 secret key in a file, e.g. `burner.b58` — **it is gitignored; never
   commit it, and delete it afterwards.**
3. Serve the built app and re-record:

```bash
npm run build
npx vite preview --port 4179 &
rm -f demo/audio/scene08.wav        # regenerate the cluster narration line
python scripts/record_demo.py http://localhost:4179/ https://api.devnet.solana.com burner.b58 --cluster devnet
```

If the script rejects `--cluster` (older copy), drop the flag and instead delete the
local-validator line from `SCENES` in `scripts/record_demo.py` before re-running.

4. Watch the result and confirm three things are visible: the cluster label reads **`devnet`**, the
   wallet signing screen appears, and the confirmed signature is shown.

**If devnet is unreachable before the deadline:** keep the existing cut, but burn an on-screen
caption over the cluster-label moment saying it is a local validator — a caption, not narration
only, so a judge skimming without sound still sees the disclosure.

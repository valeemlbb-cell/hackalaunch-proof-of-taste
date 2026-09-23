# RUN.md — what the owner has to do

The agent that built this repository cannot authenticate to GitHub, upload video, or submit on the
platform. Everything below is a human step. It should take about ten minutes.

## 1. Push the repository (required — the hackathon demands a public repo)

The commits are already made locally. From `D:\warung-ops\hacka\proof-of-taste`:

```bash
gh auth login --web          # once, if `gh auth status` is not already green
gh repo create warung-ops/receipt-first --public --source=. --push
```

If `warung-ops` is not an org you own, use your own account instead:

```bash
gh repo create receipt-first --public --source=. --push
```

## 2. Turn on GitHub Pages (this produces the required live link)

`.github/workflows/pages.yml` is already in the repo and deploys on every push to `main`.

1. Repository → **Settings** → **Pages** → **Source: GitHub Actions**.
2. Re-run the workflow if the first push ran before you flipped that switch:
   `gh workflow run "Deploy to GitHub Pages"`.
3. The live URL will be `https://<owner>.github.io/receipt-first/`.

The workflow runs `npm test` before building, so a broken push will not deploy.

## 3. Upload the demo video

`demo/demo.mp4` — 1920x1080, 2 minutes 30 seconds, 14 MB. It is **not** committed (the repo
ignores `demo/`), because the hackathon wants a video link, not a file in git.

Upload it unlisted to YouTube (or Loom / Vimeo / X) and keep the link.

## 4. Fill the two placeholders in README.md

At the bottom of `README.md`:

```
- Live app: <the GitHub Pages URL from step 2>
- Demo video: <the video link from step 3>
```

Then `git commit -am "docs: add live and video links" && git push`.

## 5. Submit

Open <https://hackalaunch.com/h/proof-of-taste> and paste the submission text prepared for you in
the dashboard action `hacka-proof-of-taste` (Warung Ops dashboard → the button whose title starts
with the prize). It contains the description and the design statement; the three links are the ones
from steps 1–3.

Payout address on file: `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q`.

**Deadline: Sep 25, 00:28 UTC — 07:28 WIB.**

## Optional but worth it: re-record the demo against real devnet

The recorded run used a local `solana-test-validator`, because the public devnet faucet was
rate-limiting this machine. The README says so plainly, and the app prints the real cluster, so the
video is honest — but a genuine devnet run is a stronger submission.

1. Get ~0.05 devnet SOL into a throwaway address at <https://faucet.solana.com> (GitHub login).
2. Put that keypair's base58 secret key in a file, e.g. `burner.b58`.
3. Serve the built app and re-record:

```bash
npm run build
npx vite preview --port 4179 &
python scripts/record_demo.py http://localhost:4179/ https://api.devnet.solana.com burner.b58
```

The narration line about the local validator is in `SCENES` in `scripts/record_demo.py` — delete or
reword it before re-recording, and delete `demo/audio/scene08.wav` so that line is regenerated.

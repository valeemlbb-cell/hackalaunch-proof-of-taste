# RUN.md — what is done, and the one thing left

## Done, verified

1. **Repository is public.** <https://github.com/valeemlbb-cell/hackalaunch-proof-of-taste>, MIT.
2. **Live link is up.** <https://valeemlbb-cell.github.io/hackalaunch-proof-of-taste/>
   `.github/workflows/pages.yml` runs `npm ci && npm test && npm run build` and publishes `dist/`
   on every push to `main`, so a red test suite never reaches the live URL. The bundle is built
   with `base: './'`, so it works at the project subpath — verified by fetching the deployed
   `index.html` and both asset files (HTTP 200).
3. **Demo recorded.** `demo.mp4` (1920×1080, 13.5 MB) and `demo_x.mp4` (1280×720, 4.3 MB, sized
   for X's upload limit). Both are **138 s**, inside X's 140 s cap and the hackathon's 3-minute cap.
   Real browser, real transaction, real confirmation, real verification — see below.

## The one thing left: a public-devnet run in the video

The recorded run is a genuine end-to-end transaction — built, signed, submitted, confirmed, then
re-derived from the chain and hash-compared — but against a **local `solana-test-validator`**,
because this machine's IP is inside the public devnet faucet's cooldown window and could not get
test SOL. The video does not pretend otherwise: the app identifies the cluster from its genesis
hash, so the stamp on screen reads `CONFIRMED ON UNRECOGNISED-CLUSTER:6PNJNP16`, and the narration
says why.

To swap it for a public-devnet run, all that is needed is test SOL:

```bash
# 1. fund a throwaway address (any of these; the faucet is the only blocker)
solana-keygen new --no-bip39-passphrase --outfile burner.json
solana airdrop 1 $(solana-keygen pubkey burner.json) --url https://api.devnet.solana.com
#    ...or paste the address into https://faucet.solana.com

# 2. write its base58 secret key to burner.b58, then record against the LIVE site
python scripts/record_demo.py \
    https://valeemlbb-cell.github.io/hackalaunch-proof-of-taste/ \
    https://api.devnet.solana.com \
    burner.b58 --cluster devnet
```

That rewrites `demo.mp4` and `demo_x.mp4` in place at the same 138 s timing. `--cluster devnet`
only selects the honest narration line; the app still reads the genesis hash itself, so if the run
somehow did not reach devnet the stamp on screen would contradict the voice-over rather than hide
it. About **0.007 SOL** covers one badge, most of it a reclaimable rent deposit.

Recording against the deployed HTTPS URL requires an HTTPS RPC (devnet is). A local validator is
plain HTTP, which is why the rehearsal is recorded against `http://localhost:4179/` instead:

```bash
npm run build
python -m http.server 4179 --directory dist
python scripts/record_demo.py http://localhost:4179/ http://127.0.0.1:8899 burner.b58 --cluster local
```

## Still human-only

- **Upload the video** and get a link. The platform wants a URL, not a file, so `demo.mp4` and
  `demo_x.mp4` are deliberately not committed. Unlisted YouTube, Loom, Vimeo or X all qualify.
- **Submit.** <https://hackalaunch.com/h/proof-of-taste> — the exact field text is in
  [SUBMISSION.md](SUBMISSION.md). An agent never submits on the platform.

Payout address on file: `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q`.

**Deadline: Sep 25, 00:28 UTC — 07:28 WIB.**

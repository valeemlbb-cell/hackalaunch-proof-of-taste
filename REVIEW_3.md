# REVIEW_3 — token-holder vote audit (proof-of-taste / "Receipt-First")

Judge 3, 2026-09-24. Perspective: a $HACKA holder with a 24-hour window deciding where the
25.27 SOL pool (plus all future fee claims) goes.

**Note on rules:** the live rules page (https://hackalaunch.com/h/proof-of-taste) could not be
re-read — WebFetch is blocked for that domain in this environment. I audited against the locally
recorded rule line in `D:\warung-ops\hacka\DEADLINES.md` (network + every program ID / mint /
external protocol in README; video <= 3 min; "design choice I'm proudest of" sentence in the
description; no secrets) plus the platform default. A human should eyeball the live page once
before submitting.

## Score: 76 / 100

Would I vote for it over a typical submission? **Yes, if I can click something.** As the packet
stands right now, a voter lands on three `<REPO_URL>` / `<LIVE_URL>` / `<VIDEO_URL>` placeholders
and votes for whoever shipped a link. Everything separating 76 from 90 is distribution, not craft.

## What earns the vote

- The premise reads in one sentence and is obviously useful: the disclosure you were shown is
  hashed into the transaction you signed, and anybody can re-derive it from the chain. That is a
  real answer to blind-signing, not a hackathon toy.
- It genuinely satisfies the brief that design and mechanic are one thing — the taste changes the
  on-chain `taste` field and the hash covers it. Most "design hackathon" entries pick an accent
  colour; this one makes the look part of the signed payload.
- No custom program, mint authority revoked in the same transaction, close authority left with the
  user, cluster identified by genesis hash and mainnet refused outright. A holder reading this sees
  someone who cannot rug the winner's future fee stream.
- Rules compliance on paper is clean: network named, all five program IDs tabled, per-badge mint
  explained rather than fudged, external protocols listed, MIT, `.env.example` only, 59 tests,
  2:30 video with a 3.6 MB fallback cut, proudest-choice sentence present verbatim.
- The AI-agent disclosure and the honest "recorded against a local validator" admission read as
  integrity, not weakness.

## What costs it votes

1. **Nothing is live.** Repo unpushed, Pages not enabled, video not uploaded. Three placeholders in
   SUBMISSION.md. In a 24-hour holder vote almost nobody reads a repo; they open the demo and the
   app. This is the whole gap.
2. **The demo is not on devnet.** The recorded run used a local `solana-test-validator`. A voter who
   notices reads "did not actually run on the network it claims". The fix is buried in RUN.md as
   "optional".
3. **No artifact a voter can verify themselves.** The strongest possible proof — a real devnet
   signature plus a one-click Verify permalink (`/#/verify?sig=...`) that shows MATCH — does not
   exist anywhere in the packet. The idea is *verification*; give them something to verify.
4. **Hard to grasp in 5 seconds.** "Receipt-First" plus thirteen instructions is a security story.
   The README opens with prose; there is no single before/after image (wallet hex blob vs the
   receipt) at the top that makes the point without reading.
5. **Voter-facing surface is thin.** No shareable X payload, no OG image, no quotable hook line
   pinned in SUBMISSION.md for the vote window. Submission ends at "submit", not at "get votes".
6. Minor: docs screenshots are PNG at unknown weight; the app's own footer link and the
   burner-wallet flow should be visible in the first 20 s of the video, since "can I try it without
   risk" is the voter's first question.

## The single change that most raises its odds

**Ship it live and put a real devnet receipt in front of the voter.** Concretely, one sequence:
push -> enable Pages -> mint one badge on real devnet from the deployed site -> paste that
signature's Verify permalink and the Solana Explorer link into the top of README and SUBMISSION,
and re-record (or re-narrate scene 08 of) the demo against real devnet. That converts the entry
from "trust this repo" into "click here, check it yourself" — which is exactly the thesis of the
project, and the only thing that reliably moves a token-holder vote.

## Concrete fixes, ordered

1. Execute RUN.md steps 1–4 now (push, Pages, video upload, fill placeholders). Nothing else
   matters until the three links resolve.
2. Do the "optional" real-devnet run and make it the recorded demo; delete `demo/audio/scene08.wav`
   and the local-validator narration line as RUN.md already describes.
3. Add a `?sig=` (or `#verify=`) deep link to the Verify tab and put one real devnet signature at
   the top of README: "Don't trust us — verify this one." Add the Explorer link beside it.
4. Add a top-of-README before/after image: wallet hex blob on the left, the receipt on the right.
   Reuse `docs/02-receipt-editorial.png` for the right half.
5. Pin a hook line in SUBMISSION.md for the vote window, e.g. "The disclosure you read is hashed
   into the transaction you sign. Here's a devnet tx — go check it." Prepare the X/Telegram payload
   files now so the owner only approves and posts.
6. Add an OG image / `<meta>` tags to `index.html` so the live link unfurls in the voting thread.
7. Verify on the live rules page that the description field accepts the full paragraph and that the
   video host is acceptable; confirm video duration reads <= 3:00 on the platform's own player.
8. Keep `demo_small.mp4` as the upload if the platform has a size cap; confirm 720p captions/text in
   the receipt are still legible at that bitrate.

## Disqualifier check

No blocking violation found against the recorded rule line — **but** an unpushed repo and
unfilled link placeholders are a *de facto* disqualifier if submitted as-is, since the platform
requires a public repo, a demo video and a description with working links.

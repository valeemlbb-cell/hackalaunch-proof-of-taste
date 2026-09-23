# Submission — Proof of Taste (HackaLaunch)

- **Project name:** Receipt-First
- **Hackathon:** https://hackalaunch.com/h/proof-of-taste
- **Network:** Solana **devnet** only
- **Repository:** `<REPO_URL>` _(placeholder — filled in after `gh repo create` per RUN.md step 1)_
- **Live app:** `<LIVE_URL>` _(placeholder — GitHub Pages URL from RUN.md step 2)_
- **Demo video:** `<VIDEO_URL>` _(placeholder — upload `demo.mp4` / `demo_small.mp4`, RUN.md step 3)_
- **Payout address:** `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q`
- **Team:** Warung Ops — Henggar (rakavaleeqa@warungsosmed.store, Telegram @sambobolo, X @issue0x)

---

## Description (one paragraph — paste this into the platform)

**Receipt-First** turns the disclosure you read into part of the transaction you sign. Every wallet
asks you to approve a hex blob while the app next to it shows marketing copy; if the two disagree
you find out afterwards and cannot prove what you were shown. Receipt-First decodes the transaction
it is about to ask you to sign — all thirteen instructions, every lamport, what you get, what can go
wrong — renders it as a plain-English receipt, then hashes that receipt with SHA-256 and writes the
hash **into the transaction itself**: once as an SPL memo, once as a `receipt` field in the badge's
own Token-2022 metadata. Afterwards anyone can fetch the confirmed transaction, re-derive the
receipt from its instructions alone, hash it, and compare — a check that is built into the app's
Verify tab and trusts nothing the app remembers. Minting a Taste Badge uses no custom program: it is
Token-2022 plus its metadata extension, mint authority revoked in the same transaction, close
authority left with you, so there is no upgrade authority anywhere that could change the rules after
you signed.

## The design choice I am proudest of

The receipt is not a summary of the transaction — it is an **input** to it: change one sentence of
the disclosure and the hash changes, so the transaction you sign is literally a different
transaction. Honest copy is enforced by the cryptography instead of by good intentions. The four
tastes — Swiss, Brutal, Editorial, Terminal — are not four accent colours: each moves palette, type,
border weight, radius, shadow and texture together, **and** changes the token that lands in your
wallet (its name and its on-chain `taste` field). The receipt hash covers the taste, so the look you
chose is part of what you signed for. The on-chain mechanic and the design are the same thing.

---

## Requirement checklist — point by point

| Requirement | Where it is met |
|---|---|
| **Public GitHub repo** | Prepared locally with commits; pushed by the owner via `RUN.md` step 1 (`gh repo create … --public --push`). MIT licence in `LICENSE`. |
| **README names the network** | `README.md` — "Solana devnet", stated in the first lines, in the *Programs and addresses* table, and in the footer of the app itself. |
| **README names every program ID touched** | `README.md` → *Programs and addresses*: Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`, ATA `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`, Memo `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`, System `11111111111111111111111111111111`, Compute Budget `ComputeBudget111111111111111111111111111111`. |
| **README names mint addresses** | Same section: each badge mints a **fresh keypair**, so there is no fixed mint to list — the README says so, and the mint address is shown in the receipt before signing and in the Verify output afterwards. The mint from the recorded run appears on screen in the video. |
| **README names external protocols** | Token-2022 metadata extension, Associated Token Account program, SPL Memo — all listed. No oracle, no AMM, no backend, no third-party API. |
| **Video ≤ 3 minutes** | `demo.mp4` — **2 min 30 s**, 1920×1080, English voice-over. `demo_small.mp4` is the same cut at 720p, 3.6 MB, for upload limits. |
| **Description contains the "design choice I'm proudest of" sentence** | See *The design choice I am proudest of* above — included verbatim in the pasted description. |
| **No secrets in the repo** | No API keys, no private keys, no seed phrases. `.env.example` only, holding a single public RPC URL. `.gitignore` excludes `.env`, `demo/`, `demo.mp4`, `demo_small.mp4`. The app never asks anyone for a seed phrase or a private key. |
| **Design and on-chain mechanic are one thing** (the brief) | The taste selection changes palette/type/border/radius/shadow/texture **and** the minted token's name and on-chain `taste` field; the receipt hash covers the taste, so the visual choice is cryptographically part of the signed transaction. |
| **Devnet only / no real money** | Cluster is identified by **genesis hash**, never by RPC URL; pointed at mainnet-beta the app refuses to build a transaction at all; an unknown cluster prints `unrecognised-cluster:<prefix>` rather than claiming devnet. |
| **Tests** | 59 passing (`npm test`), including `tests/roundtrip.test.ts`: build → compile → rebuild the receipt from the compiled transaction alone → hashes must agree, and a one-lamport change must break them. |
| **Licensing** | Project MIT. Fonts Inter, Instrument Serif, IBM Plex Mono — all SIL OFL 1.1. No third-party artwork. Dependencies Apache-2.0 / MIT. |

## Built during the hackathon vs before

**Built during the hackathon window, for this hackathon:** all application code — `src/`, `tests/`
(59 tests), `index.html`, the four taste systems and all styles, the instruction decoder, the
canonical-JSON receipt hashing and redaction, the genesis-hash cluster guard, the Verify tab, the
README, the GitHub Pages workflow. Nothing was imported from earlier projects.

**Pre-existing (marked as such in the README):** our team's general approach to producing demo
videos — drive the real app in Playwright, capture the page, generate per-scene voice-over, mux with
ffmpeg. The approach is pre-existing; `scripts/record_demo.py` itself was written here and is
specific to this app.

**AI-agent disclosure:** implemented by an AI coding agent (Anthropic's Claude, via Claude Code)
from a human-written brief, under human direction and review — disclosed in the README.

## Honest status (also in the README)

The public devnet faucet was rate-limiting this machine's IP while the demo was recorded, so the
recorded run ran against a local `solana-test-validator`. This is visible in the video: the receipt
honestly prints `unrecognised-cluster:…` rather than pretending to be devnet. The code path is
identical — point it at devnet with SOL in the signer and it prints `devnet`. `RUN.md` contains the
exact steps to re-record against public devnet if the owner wants a stronger submission before the
deadline.

**Deadline:** Sep 25, 00:28 UTC (07:28 WIB). Voting opens at close for 24 h.

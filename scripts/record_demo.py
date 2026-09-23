"""
Records the demo video: a real browser, a real transaction, a real verification.

    python scripts/record_demo.py <app-url> <rpc-url> <burner-base58-file>

Nothing is faked. The script drives the built app in Chromium, signs with a
disposable keypair whose secret key it seeds into localStorage, waits for the
cluster to confirm, and then runs the verifier on the signature it got back.
The voice-over is generated per scene and placed at that scene's start time, so
the words line up with what is on screen.

Requires: playwright (with chromium), edge-tts, ffmpeg on PATH.
"""

from __future__ import annotations

import asyncio
import pathlib
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "demo"
WIDTH, HEIGHT = 1920, 1080
VOICE = "en-US-AriaNeural"
SAPI_VOICE = "Microsoft Hazel Desktop"

# (start second, narration). The browser script waits for each start time, so
# the visuals and the voice-over stay in step without any manual editing.
SCENES: list[tuple[float, str]] = [
    (0.0, "Every Solana app asks you to approve a transaction you cannot read. "
          "Receipt First turns that transaction into a receipt in plain English, "
          "and then staples that receipt to the chain."),
    (13.0, "Pick a taste. The taste is not a theme sitting on top of the app. "
           "It is the thing that gets minted, so changing it changes the token you receive."),
    (24.0, "Connect a signer. No wallet installed? A disposable devnet burner is generated "
           "right here in the browser, and it says so in as many words."),
    (33.0, "Here is the receipt. Thirteen instructions, each one decoded and described. "
           "Nothing is guessed: an instruction this app cannot explain is flagged, "
           "and it disables the sign button entirely."),
    (47.0, "Then the money. Rent deposits that you can reclaim are marked separately from "
           "the network fee that you cannot. The app tells you the exact figure that never comes back."),
    (61.0, "What you get. What can go wrong. Written as sentences, not as a hex blob."),
    (71.0, "And this is the trick. The whole receipt is hashed with SHA two fifty six, "
           "and you can open up the exact bytes that go into that hash."),
    (83.0, "The sign button stays disabled until the risks are acknowledged. "
           "Now we sign, and the hash rides along inside the transaction: "
           "once in the memo, once in the token's own on-chain metadata."),
    (99.0, "Confirmed. And look at the cluster label. This run is against a local validator, "
           "because the public devnet faucet was rate limiting us while recording. "
           "The app prints the cluster it actually found, from the genesis hash, rather than "
           "claiming devnet. It refuses to build anything at all against mainnet."),
    (108.0, "So let us check it. The verifier fetches the confirmed transaction, "
            "decodes the instructions with the same decoder, regenerates every sentence, "
            "hashes the result, and compares."),
    (124.0, "Match. The words on the screen and the transaction on the chain are provably the same. "
            "And the amount the chain actually took is the amount the receipt quoted, to the lamport."),
    (137.0, "Disclosure you can check afterwards. That is the mechanic, and it is also the design."),
]

DURATION = 150.0


async def _speak_edge(text: str, path: pathlib.Path) -> None:
    import edge_tts

    await edge_tts.Communicate(text, VOICE).save(str(path))


def _speak_sapi(text: str, path: pathlib.Path) -> None:
    """Offline fallback: the speech engine that ships with Windows."""
    script = path.with_suffix(".ps1")
    lines = [
        "Add-Type -AssemblyName System.Speech",
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
        f'try {{ $s.SelectVoice("{SAPI_VOICE}") }} catch {{}}',
        "$s.Rate = 0",
        f'$s.SetOutputToWaveFile("{path}")',
        "$s.Speak(@'",
        text,
        "'@)",
        "$s.Dispose()",
    ]
    script.write_text("\n".join(lines) + "\n", encoding="utf-8")
    subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(script)],
        check=True, capture_output=True,
    )
    script.unlink(missing_ok=True)


def speak(text: str, path: pathlib.Path) -> pathlib.Path:
    """Prefer the neural voice; fall back to the local engine when offline."""
    try:
        asyncio.run(_speak_edge(text, path))
        if path.stat().st_size > 1024:
            return path
    except Exception as error:  # noqa: BLE001 - any failure means "use the fallback"
        print(f"edge-tts unavailable ({type(error).__name__}), using the local voice")
    wav = path.with_suffix(".wav")
    _speak_sapi(text, wav)
    return wav


def build_voiceover(audio_dir: pathlib.Path) -> pathlib.Path:
    audio_dir.mkdir(parents=True, exist_ok=True)
    parts = []
    for index, (start, text) in enumerate(SCENES):
        target = audio_dir / f"scene{index:02d}.mp3"
        existing = [c for c in (target, target.with_suffix(".wav")) if c.exists() and c.stat().st_size > 1024]
        parts.append((start, existing[0] if existing else speak(text, target)))

    inputs: list[str] = []
    filters: list[str] = []
    for index, (start, path) in enumerate(parts):
        inputs += ["-i", str(path)]
        filters.append(f"[{index}:a]adelay={int(start * 1000)}|{int(start * 1000)},apad[a{index}]")
    mix = "".join(f"[a{i}]" for i in range(len(parts)))
    filters.append(f"{mix}amix=inputs={len(parts)}:duration=longest:normalize=0[out]")

    track = audio_dir / "voiceover.m4a"
    subprocess.run(
        ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters),
         "-map", "[out]", "-t", str(DURATION), "-c:a", "aac", "-b:a", "160k", str(track)],
        check=True, capture_output=True,
    )
    return track


def record(app_url: str, rpc_url: str, secret_key: str, video_dir: pathlib.Path) -> pathlib.Path:
    started = time.monotonic()

    def at(second: float) -> None:
        """Hold until this scene is due, so narration and picture stay aligned."""
        remaining = second - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(remaining)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            record_video_dir=str(video_dir),
            record_video_size={"width": WIDTH, "height": HEIGHT},
        )
        page = ctx.new_page()
        page.goto(app_url, wait_until="load")
        page.evaluate(
            "([sk, rpc]) => { localStorage.setItem('taste.burner.devnet.v1', sk);"
            " localStorage.setItem('taste.rpc.devnet', rpc); }",
            [secret_key, rpc_url],
        )
        page.reload(wait_until="load")
        started = time.monotonic()

        at(6);   page.mouse.wheel(0, 260)
        at(10);  page.mouse.wheel(0, -260)

        at(14);  page.click("[data-taste-id='brutal']")
        at(17);  page.click("[data-taste-id='terminal']")
        at(20);  page.click("[data-taste-id='editorial']")

        at(25);  page.click("text=Use a devnet burner instead")
        page.wait_for_selector(".receipt", timeout=60000)

        at(34);  page.locator(".steps").scroll_into_view_if_needed()
        at(40);  page.mouse.wheel(0, 320)
        at(48);  page.locator(".costs").scroll_into_view_if_needed()
        at(55);  page.mouse.wheel(0, 240)
        at(62);  page.locator(".bullets--risk").scroll_into_view_if_needed()
        at(72);  page.locator(".hashstrip").first.scroll_into_view_if_needed()
        at(76);  page.click("details.raw summary")
        at(82);  page.click("details.raw summary")

        at(84);  page.locator(".gate").scroll_into_view_if_needed()
        at(88);  page.check("#ack")
        at(91);  page.click(".gate .btn--wide")
        page.wait_for_selector(".receipt__stamp--ok, .receipt__stamp--bad", timeout=120000)

        at(100); page.locator(".receipt__stamp").scroll_into_view_if_needed()
        signature = page.input_value("#verify-input")
        print("signature:", signature)

        at(109); page.click("[data-tab='verify']")
        at(114); page.click(".verify-form button")
        page.wait_for_selector("#verify-stage .verdict--match, #verify-stage .verdict--mismatch",
                               timeout=120000)

        at(124); page.locator("#verify-stage .verdict--match, #verify-stage .verdict--mismatch") \
                     .first.scroll_into_view_if_needed()
        at(131); page.locator("#verify-stage .costs").scroll_into_view_if_needed()
        at(140); page.mouse.wheel(0, -600)
        at(DURATION)

        path = page.video.path()
        ctx.close()
        browser.close()
    return pathlib.Path(path)


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    app_url, rpc_url, key_file = sys.argv[1], sys.argv[2], sys.argv[3]
    secret_key = pathlib.Path(key_file).read_text(encoding="utf-8").strip()

    OUT.mkdir(parents=True, exist_ok=True)
    track = build_voiceover(OUT / "audio")
    raw = record(app_url, rpc_url, secret_key, OUT / "raw")

    final = OUT / "demo.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw), "-i", str(track),
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
         "-vf", f"scale={WIDTH}:{HEIGHT}:flags=lanczos,fps=30",
         "-c:a", "aac", "-b:a", "160k", "-shortest", str(final)],
        check=True, capture_output=True,
    )
    print("wrote", final)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

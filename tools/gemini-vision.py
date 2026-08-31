#!/usr/bin/env python3
"""Vision bridge: send image to a Google vision model, print analysis.

Usage:
  gemini-vision.py <image> [question] [model]

Models (POOL — both have 500 req/day each, ~1000/day total):
  gemini-3.5-flash-lite  (default; fastest ~1.5-6s; best concise answers)
  gemini-3.1-flash-lite  (fallback/second opinion; slower ~5-24s)

Auth: reads GOOGLE_API_KEY from .env (repo root) or environment.
NEVER hardcode the key here — this file is pushed to a PUBLIC repo.

Strategy:
- Default: gemini-3.5-flash-lite.
- If quota error (429) or timeout: retry with the other model.
- For critical decisions, pass "both" as model to get a cross-check.

Known behavior (validated 2026-08-31 with instrumented ground truth):
- Both correctly identified synthetic colors, HUD readings (timer/HP/ammo),
  and enemy presence/absence in live BLOCKFIRE frames.
- Both detected a real dark band over the sky but misattributed its cause
  (vignette/banding) when the true cause was the HUD chip overlay.
  => USE vision to DETECT anomalies; use pixel analysis (PIL) to EXPLAIN them.
"""
import sys, os, base64, json, subprocess, mimetypes

MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]

def get_key():
    """Key from env, or from .env at repo root (gitignored)."""
    key = os.environ.get("GOOGLE_API_KEY")
    if key:
        return key
    # buscar .env subiendo desde este archivo
    d = os.path.dirname(os.path.abspath(__file__))
    for _ in range(3):
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line.startswith("GOOGLE_API_KEY="):
                    return line.split("=", 1)[1].strip()
        d = os.path.dirname(d)
    return None

def ask(model, img_path, question, key, timeout=150):
    with open(img_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    mime = mimetypes.guess_type(img_path)[0] or "image/png"
    payload = {"contents": [{"parts": [
        {"text": question},
        {"inline_data": {"mime_type": mime, "data": b64}}
    ]}]}
    tmp = "/tmp/gemini-payload.json"
    with open(tmp, "w") as f:
        json.dump(payload, f)
    out = subprocess.run([
        "curl", "-s", "-m", str(timeout),
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "-H", f"x-goog-api-key: {key}",
        "-H", "Content-Type: application/json",
        "--data-binary", f"@{tmp}"
    ], capture_output=True, text=True).stdout
    d = json.loads(out)
    if "error" in d:
        return "ERROR: " + d["error"].get("message", "")[:300]
    return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    key = get_key()
    if not key:
        print("ERROR: GOOGLE_API_KEY not found. Set it in .env (repo root, gitignored) "
              "as GOOGLE_API_KEY=... or export it.", file=sys.stderr)
        sys.exit(1)
    img = sys.argv[1]
    question = sys.argv[2] if len(sys.argv) > 2 else "Describe this image objectively."
    model = sys.argv[3] if len(sys.argv) > 3 else MODELS[0]

    if model == "both":
        for m in MODELS:
            print(f"===== {m} =====")
            print(ask(m, img, question, key))
            print()
        return
    if model not in MODELS:
        print(f"unknown model '{model}'; valid: {MODELS} or 'both'"); sys.exit(1)

    ans = ask(model, img, question, key)
    if ans.startswith("ERROR:") and ("quota" in ans.lower() or "429" in ans or "exceeded" in ans.lower()):
        fallback = MODELS[1] if model == MODELS[0] else MODELS[0]
        print(f"[{model} quota/err → falling back to {fallback}]", file=sys.stderr)
        ans = ask(fallback, img, question, key)
    print(f"[model: {model}]", file=sys.stderr)
    print(ans)

if __name__ == "__main__":
    main()

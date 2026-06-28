#!/usr/bin/env python3
"""Run FLUX ad-gen + Qwen vision tests on RunPod (generates test doc on pod)."""
from __future__ import annotations

import base64
import sys
import time

import paramiko

SSH_HOST = "ssh.runpod.io"
SSH_USER = "fylvirr5y9slvo-64410ffb"
SSH_KEY = "/home/sammy/.ssh/id_ed25519"

REMOTE_TEST = r"""#!/bin/bash
set -euo pipefail
echo "=== GPU ==="
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader
echo "=== MODELS ==="
ollama list

echo ""
echo "=== TEST 1: FLUX AD IMAGE ==="
python3 - <<'PY'
import json, time, urllib.request, base64
payload = {
  "model": "x/flux2-klein:4b",
  "prompt": "Meta ad hero image, modern coffee shop, warm morning light, professional marketing photo",
  "stream": False, "width": 512, "height": 512, "steps": 4,
}
t0 = time.time()
req = urllib.request.Request(
    "http://127.0.0.1:11434/api/generate",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)
with urllib.request.urlopen(req, timeout=600) as resp:
    data = json.loads(resp.read().decode())
elapsed = time.time() - t0
img_b64 = data.get("image") or ((data.get("images") or [None])[0])
if img_b64:
    raw = base64.b64decode(img_b64)
    open("/tmp/test_ad_flux.png", "wb").write(raw)
    print("FLUX_STATUS=SUCCESS")
    print("FLUX_ELAPSED_SEC=" + str(round(elapsed, 1)))
    print("FLUX_IMAGE_BYTES=" + str(len(raw)))
else:
    print("FLUX_STATUS=FAILED")
    print("FLUX_ERROR=" + str(data.get("error", data))[:300])
PY

echo ""
echo "=== TEST 2: QWEN GOVT DOC OCR ==="
python3 - <<'PY'
import json, time, urllib.request, base64
try:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (700, 440), (245, 245, 245))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 680, 420], outline=(0, 0, 0), width=2)
    d.text((40, 40), (
        "INCOME CERTIFICATE APPLICATION\\n"
        "Applicant Name: Ravi Kumar\\n"
        "Father Name: Suresh Kumar\\n"
        "Date of Birth: 1998-04-20\\n"
        "Mobile: 9999999999\\n"
        "Address: House No 12, Delhi\\n"
        "Pincode: 110001\\n"
        "Annual Income: 240000"
    ), fill=(0, 0, 0))
    img.save("/tmp/gov_test_document.png")
except Exception as e:
    print("DOC_CREATE_FAILED=" + str(e))
    raise
b64 = base64.b64encode(open("/tmp/gov_test_document.png", "rb").read()).decode()
prompt = (
    "Extract fields from this Indian government form. "
    "Return JSON only with keys: full_name, father_name, dob, mobile, "
    "address_line1, pincode, annual_income. Use null if missing."
)
payload = {
  "model": "qwen2.5vl:7b",
  "messages": [{"role": "user", "content": prompt, "images": [b64]}],
  "stream": False, "format": "json",
}
t0 = time.time()
req = urllib.request.Request(
    "http://127.0.0.1:11434/api/chat",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"}, method="POST",
)
with urllib.request.urlopen(req, timeout=300) as resp:
    data = json.loads(resp.read().decode())
elapsed = time.time() - t0
content = data.get("message", {}).get("content", "")
print("QWEN_STATUS=" + ("SUCCESS" if content else "FAILED"))
print("QWEN_ELAPSED_SEC=" + str(round(elapsed, 1)))
print("QWEN_JSON_START")
print(content[:1200])
print("QWEN_JSON_END")
PY

echo "ALL_TESTS_DONE"
"""


def main() -> int:
    print("=" * 60)
    print("RUNPOD GPU TEST SUITE")
    print("=" * 60)

    script_b64 = base64.b64encode(REMOTE_TEST.encode()).decode()
    remote_cmd = f"echo {script_b64} | base64 -d | bash"

    key = paramiko.Ed25519Key.from_private_key_file(SSH_KEY)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SSH_HOST, username=SSH_USER, pkey=key, timeout=30)

    # RunPod SSH proxy requires a PTY; pass script via base64 one-liner (not stdin).
    stdin, stdout, stderr = client.exec_command(remote_cmd, get_pty=True, timeout=900)
    stdin.close()
    out_lines: list[str] = []
    err_lines: list[str] = []

    start = time.time()
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(65536).decode(errors="replace")
            for line in chunk.splitlines():
                line = line.rstrip()
                if line:
                    print(line)
                    out_lines.append(line)
        if stderr.channel.recv_stderr_ready():
            err_chunk = stderr.channel.recv_stderr(65536).decode(errors="replace")
            for line in err_chunk.splitlines():
                line = line.rstrip()
                if line:
                    print(f"[stderr] {line}", file=sys.stderr)
                    err_lines.append(line)
        if time.time() - start > 900:
            print("TIMEOUT after 900s")
            break
        time.sleep(0.2)

    while stdout.channel.recv_ready():
        chunk = stdout.channel.recv(65536).decode(errors="replace")
        for line in chunk.splitlines():
            line = line.rstrip()
            if line:
                print(line)
                out_lines.append(line)
    while stderr.channel.recv_stderr_ready():
        err_chunk = stderr.channel.recv_stderr(65536).decode(errors="replace")
        for line in err_chunk.splitlines():
            line = line.rstrip()
            if line:
                print(f"[stderr] {line}", file=sys.stderr)
                err_lines.append(line)

    code = stdout.channel.recv_exit_status()
    client.close()

    text = "\n".join(out_lines)
    flux_ok = "FLUX_STATUS=SUCCESS" in text
    qwen_ok = "QWEN_STATUS=SUCCESS" in text

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for marker in (
        "FLUX_STATUS", "FLUX_ELAPSED_SEC", "FLUX_IMAGE_BYTES", "FLUX_ERROR",
        "QWEN_STATUS", "QWEN_ELAPSED_SEC", "DOC_CREATE_FAILED",
    ):
        for line in out_lines:
            if line.startswith(marker + "="):
                print(line)
                break

    if qwen_ok:
        in_json = False
        for line in out_lines:
            if line == "QWEN_JSON_START":
                in_json = True
                print("QWEN_EXTRACTED:")
                continue
            if line == "QWEN_JSON_END":
                in_json = False
                continue
            if in_json:
                print("  " + line)

    print(f"TEST 1 FLUX ad image:    {'PASS' if flux_ok else 'FAIL'}")
    print(f"TEST 2 Qwen doc extract: {'PASS' if qwen_ok else 'FAIL'}")
    print(f"REMOTE_EXIT={code}")
    return 0 if flux_ok and qwen_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
#!/usr/bin/env python3
"""Run the TOSCAN browser against an already-running real TOS local chain."""

import os
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def wait_http(label: str, url: str, timeout: int = 180):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if 200 <= response.status < 300:
                    print(f"PASS: {label}")
                    return
        except (OSError, urllib.error.URLError) as error:
            last = error
        time.sleep(1)
    raise TimeoutError(f"{label} did not become ready: {last}")


def start(command: list[str], env: dict[str, str], log: Path):
    output = log.open("ab", buffering=0)
    process = subprocess.Popen(
        command,
        cwd=REPO,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=output,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    process._toscan_output = output  # type: ignore[attr-defined]
    return process


def stop(process):
    if process is None:
        return
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    process._toscan_output.close()  # type: ignore[attr-defined]


def main():
    rpc = os.environ.get("TOSCAN_REAL_RPC_ORIGIN")
    source = os.environ.get("TOSCAN_REAL_SOURCE_ORIGIN")
    database = os.environ.get("DATABASE_URL")
    if not rpc or not source or not database:
        raise SystemExit("TOSCAN_REAL_RPC_ORIGIN, TOSCAN_REAL_SOURCE_ORIGIN and DATABASE_URL are required")

    query_port = int(os.environ.get("TOSCAN_REAL_QUERY_PORT", "19454"))
    web_port = int(os.environ.get("TOSCAN_REAL_WEB_PORT", "19455"))
    query_origin = f"http://127.0.0.1:{query_port}"
    web_origin = f"http://127.0.0.1:{web_port}"
    workdir = Path(tempfile.mkdtemp(prefix="toscan-browser-gate-"))
    query = web = None
    try:
        query_env = dict(os.environ)
        query_env.update({
            "DATABASE_URL": database,
            "QUERY_HOST": "127.0.0.1",
            "QUERY_PORT": str(query_port),
            "QUERY_PROJECT_BATCH": "128",
            "QUERY_POLL_MS": "250",
            "QUERY_CONTRACT_SYNC_MS": "1000",
            "QUERY_READY_MAX_LAG": "0",
            "QUERY_READY_MAX_STALE_SECONDS": "15",
            "TOS_RPC_UPSTREAM": rpc,
            "TOS_SOURCE_EXPLORER": source,
        })
        query = start(
            ["pnpm", "exec", "tsx", "services/query/src/main.ts"],
            query_env,
            workdir / "query.log",
        )
        wait_http("PostgreSQL projection caught up", f"{query_origin}/readyz")

        web_env = dict(os.environ)
        web_env.update({
            "VITE_ENABLE_PREVIEW": "false",
            "VITE_FORCE_PREVIEW": "false",
            "VITE_TOS_NETWORK": "localnet",
            "TOS_RPC_PROXY_TARGET": rpc,
            "TOS_SERVICE_PROXY_TARGET": query_origin,
        })
        web = start(
            ["pnpm", "dev", "--host", "127.0.0.1", "--port", str(web_port)],
            web_env,
            workdir / "web.log",
        )
        wait_http("live browser application ready", f"{web_origin}/healthz", timeout=60)
        test_env = dict(os.environ)
        test_env["TOSCAN_REAL_WEB_ORIGIN"] = web_origin
        subprocess.run(
            ["pnpm", "exec", "playwright", "test", "--config", "playwright.real-chain.config.ts"],
            cwd=REPO,
            env=test_env,
            check=True,
        )
        print("TOSCAN REAL-CHAIN BROWSER GATE: PASS")
    except Exception:
        for name in ("query.log", "web.log"):
            log = workdir / name
            if log.exists():
                print(f"\n--- {name} (tail) ---", file=sys.stderr)
                print("\n".join(log.read_text(errors="replace").splitlines()[-100:]), file=sys.stderr)
        raise
    finally:
        stop(web)
        stop(query)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Lifecycle manager for a persistent local TOS node + explorer + TOSCAN."""

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

TOSCAN_REPO = Path(__file__).resolve().parents[1]
DEFAULT_TOS_REPO = TOSCAN_REPO.parent / "tos"
STATE_DIR = TOSCAN_REPO / ".local/stack"
PROCESS_FILE = STATE_DIR / "processes.json"

SERVICES = {
    "node": "http://127.0.0.1:8012/readyz",
    "explorer": "http://127.0.0.1:8080/health",
    "query": "http://127.0.0.1:8081/readyz",
    "web": "http://127.0.0.1:4173/",
}


def tos_repo():
    return Path(os.environ.get("TOS_REPO", DEFAULT_TOS_REPO)).resolve()


def tosctl_binary():
    return tos_repo() / "tosctl/src/target/debug/tosctl"


def compose_command():
    if shutil.which("docker-compose"):
        return ["docker-compose"]
    if shutil.which("docker"):
        return ["docker", "compose"]
    raise RuntimeError("Docker Compose is required for PostgreSQL and the web gateway")


def read_processes():
    if not PROCESS_FILE.exists():
        return {}
    try:
        return json.loads(PROCESS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def write_processes(processes):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    PROCESS_FILE.write_text(json.dumps(processes, indent=2) + "\n")


def process_command(pid: int):
    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def process_alive(record):
    pid = int(record.get("pid", 0))
    marker = record.get("marker", "")
    command = process_command(pid)
    return bool(command and marker and marker in command)


def clean_process_table():
    current = {name: row for name, row in read_processes().items() if process_alive(row)}
    write_processes(current)
    return current


def endpoint_ready(url: str):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def wait_ready(name: str, timeout: float):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if endpoint_ready(SERVICES[name]):
            return
        time.sleep(0.5)
    log = STATE_DIR / "logs" / f"{name}.log"
    raise RuntimeError(f"{name} did not become ready; inspect {log}")


def launch(name: str, command: list[str], cwd: Path, env=None):
    logs = STATE_DIR / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    log_path = logs / f"{name}.log"
    output = log_path.open("ab", buffering=0)
    process = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=output,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return {
        "pid": process.pid,
        "marker": Path(command[0]).name,
        "command": command,
        "log": str(log_path),
        "started_at": int(time.time()),
    }


def generate_explorer_config():
    config_path = STATE_DIR / "tosctl-explorer.json"
    subprocess.run(
        [
            str(tosctl_binary()), "config", "generate", "-o", str(config_path),
            "--force",
        ],
        check=True,
        cwd=tos_repo(),
    )
    config = json.loads(config_path.read_text())
    config["chain_rpc"] = {"urls": ["http://127.0.0.1:8011/"], "api_key": None}
    config["http"] = {"bind": "127.0.0.1:8080", "enable_swagger": False, "auth": None}
    config["master_wallet"] = None
    config["elections"] = None
    config["voting"] = None
    config["tick_interval"] = 2
    config["log"] = None
    config_path.write_text(json.dumps(config, indent=2) + "\n")
    return config_path


def ensure_requirements(build: bool):
    repo = tos_repo()
    if not repo.exists():
        raise RuntimeError(f"TOS repository not found: {repo}; set TOS_REPO")
    if build or not tosctl_binary().exists():
        subprocess.run(
            [
                "cargo", "build", "--manifest-path", "tosctl/src/Cargo.toml",
                "-p", "tosctl",
            ],
            check=True,
            cwd=repo,
        )
    toslib_name = "libtoslibjson.dylib" if sys.platform == "darwin" else "libtoslibjson.so"
    required = [
        repo / "build/validator-engine/validator-engine",
        repo / "build/dht-server/dht-server",
        repo / f"build/toslib/{toslib_name}",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError("build the TOS native node first; missing: " + ", ".join(missing))
    if not (TOSCAN_REPO / "node_modules").exists():
        subprocess.run(["pnpm", "install", "--frozen-lockfile"], check=True, cwd=TOSCAN_REPO)


def start(args):
    ensure_requirements(args.build)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    processes = clean_process_table()

    if "node" not in processes:
        processes["node"] = launch(
            "node",
            [
                "uv", "run", "python", "scripts/localnet-jsonrpc.py",
                "--rpc", "127.0.0.1:8011", "--control", "127.0.0.1:8012",
                "--validators", "1", "--workdir", str(STATE_DIR / "localnet"),
                "--reuse",
            ],
            tos_repo(),
        )
        write_processes(processes)
    wait_ready("node", 150)

    config_path = generate_explorer_config()
    if "explorer" not in processes:
        processes["explorer"] = launch(
            "explorer",
            [str(tosctl_binary()), "explorer", "-c", str(config_path)],
            tos_repo(),
        )
        write_processes(processes)
    wait_ready("explorer", 30)

    compose_env = dict(os.environ)
    compose_env.update({
        "VITE_TOS_NETWORK": "localnet",
        "TOS_RPC_UPSTREAM": "http://host.docker.internal:8011",
        "TOS_SOURCE_EXPLORER": "http://host.docker.internal:8080",
    })
    subprocess.run(
        [*compose_command(), "up", "--build", "-d", "postgres", "query", "toscan"],
        cwd=TOSCAN_REPO,
        env=compose_env,
        check=True,
    )
    wait_ready("query", 180)
    wait_ready("web", 30)

    if not args.no_seed:
        seed(args)
    print_status()
    print("\nTOSCAN is ready at http://127.0.0.1:4173")


def seed(_args=None):
    if not endpoint_ready(SERVICES["node"]):
        raise RuntimeError("local node is not running; run `pnpm stack:up` first")
    command = [
        "uv", "run", "python", "scripts/toscan-dev-seed.py",
        "--rpc", "http://127.0.0.1:8011",
        "--control", "http://127.0.0.1:8012",
        "--config", str(STATE_DIR / "tosctl-seed.json"),
        "--manifest", str(STATE_DIR / "seed-manifest.json"),
        "--tosctl", str(tosctl_binary()),
    ]
    subprocess.run(command, check=True, cwd=tos_repo())


def stop(_args=None):
    subprocess.run(
        [*compose_command(), "stop", "toscan", "query", "postgres"],
        cwd=TOSCAN_REPO,
        check=False,
    )
    processes = read_processes()
    for name in ("explorer", "node"):
        record = processes.get(name)
        if not record or not process_alive(record):
            continue
        pid = int(record["pid"])
        print(f"Stopping {name} (pid {pid}) ...")
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            continue
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline and process_alive(record):
            time.sleep(0.25)
        if process_alive(record):
            os.killpg(pid, signal.SIGKILL)
    write_processes({})
    print("TOSCAN stack stopped; chain and index data were preserved.")


def reset(args):
    if not args.yes:
        raise RuntimeError("reset deletes the local chain/index; repeat with --yes")
    stop()
    subprocess.run(
        [*compose_command(), "down", "--volumes", "--remove-orphans"],
        cwd=TOSCAN_REPO,
        check=True,
    )
    if STATE_DIR.exists():
        shutil.rmtree(STATE_DIR)
    print("TOSCAN local chain, seed and index data were deleted.")


def print_status(_args=None):
    processes = clean_process_table()
    print("TOSCAN local stack")
    for name, url in SERVICES.items():
        record = processes.get(name)
        pid = record.get("pid") if record else "-"
        state = "ready" if endpoint_ready(url) else "stopped"
        print(f"  {name:8} {state:7} pid={pid}  {url}")


def logs(args):
    names = [args.service] if args.service else ["node", "explorer"]
    for name in names:
        path = STATE_DIR / "logs" / f"{name}.log"
        print(f"\n== {name}: {path} ==")
        if not path.exists():
            print("(no log)")
            continue
        lines = path.read_text(errors="replace").splitlines()
        print("\n".join(lines[-args.lines:]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    up = subcommands.add_parser("up", help="start the full stack and seed it")
    up.add_argument("--build", action="store_true", help="rebuild tosctl first")
    up.add_argument("--no-seed", action="store_true")
    up.set_defaults(function=start)
    subcommands.add_parser("seed", help="provision/recheck Agent Economy seed").set_defaults(
        function=seed
    )
    subcommands.add_parser("stop", help="stop while preserving state").set_defaults(function=stop)
    subcommands.add_parser("status", help="show component health").set_defaults(
        function=print_status
    )
    reset_parser = subcommands.add_parser("reset", help="delete local chain/index state")
    reset_parser.add_argument("--yes", action="store_true")
    reset_parser.set_defaults(function=reset)
    log_parser = subcommands.add_parser("logs", help="show recent component logs")
    log_parser.add_argument("service", choices=("node", "explorer"), nargs="?")
    log_parser.add_argument("--lines", type=int, default=80)
    log_parser.set_defaults(function=logs)

    args = parser.parse_args()
    try:
        args.function(args)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()

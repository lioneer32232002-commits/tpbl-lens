"""
auto_update.py — TPBL-lens full-league updater.

Usage:
    python auto_update.py          # check + update all teams
    python auto_update.py --dry-run  # check only, no writes
"""
import argparse, json, os, subprocess, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")

from config import TEAMS, ALLGAME_FILE
from fetch_games import sync_new_games, update_team_stats, load_schedule
from build import build as run_build

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def run_process_team(team_id, dry_run=False):
    if dry_run:
        log(f"  [dry] would process team_id={team_id}")
        return True
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, os.path.join(_BASE_DIR, "process_data.py"),
         "--team-id", str(team_id)],
        cwd=_BASE_DIR, env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        log(f"  [ERROR] process_data.py --team-id {team_id}:\n{result.stderr[-400:]}")
        return False
    log(f"  {result.stdout.strip()}")
    return True


def run_generate_league(dry_run=False):
    if dry_run:
        log("  [dry] would generate league JSON")
        return True
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, os.path.join(_BASE_DIR, "generate_league.py")],
        cwd=_BASE_DIR, env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        log(f"  [ERROR] generate_league.py:\n{result.stderr[-400:]}")
        return False
    log(f"  {result.stdout.strip()}")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Check only; do not write files")
    parser.add_argument("--force", action="store_true",
                        help="Process all teams even if no new games")
    args = parser.parse_args()

    log("=" * 50)
    log("tpbl-lens auto-update started")
    log("=" * 50)

    schedule = load_schedule()

    log("Syncing new game files...")
    new_count = sync_new_games(schedule)
    log(f"  New games fetched: {new_count}")

    log("Updating team aggregate stats...")
    if not args.dry_run:
        try:
            update_team_stats()
        except Exception as e:
            log(f"  [WARN] team stats update failed: {e}")

    if new_count == 0 and not args.dry_run and not args.force:
        log("No new games. Skipping processing.")
        log("=" * 50)
        log("Done (no changes)")
        log("=" * 50)
        return

    log("Processing all teams...")
    errors = []
    for team_id in sorted(TEAMS.keys()):
        slug = TEAMS[team_id]["slug"]
        log(f"  Processing {slug} (id={team_id})...")
        ok = run_process_team(team_id, args.dry_run)
        if not ok:
            errors.append(team_id)

    log("Generating league JSON...")
    run_generate_league(args.dry_run)

    if not args.dry_run:
        run_build()
        print("[auto_update] build complete")

    log("=" * 50)
    if errors:
        log(f"Done with errors: team_ids {errors}")
        sys.exit(1)
    else:
        log("Done — all teams updated successfully")
    log("=" * 50)


if __name__ == "__main__":
    main()

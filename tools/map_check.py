#!/usr/bin/env python3
"""Check that docs/map still matches the repo (read-only, stdlib only, no network, no secrets).

Exit 0 = clean, 1 = something drifted. Run weekly and after any merge that touches code.

Checks
  1. map/CLAUDE.md, AGENTS.md and routing.md are byte-identical twins.
  2. Every [[link]] resolves to a card or process, and every card is listed in objects/_index.md.
  3. Every card's `entity:` path exists (entities that are not repo paths are skipped).
  4. STALE: a card's entity changed in git after the commit in its `verified_at`.
  5. README "D-001 through D-NNN" equals the highest D- number in docs/decisions.md.
  6. Every top-level folder has a CONTEXT.md (or is on the allowed list).
  7. LEFTOVER: docs that say "branch X, not merged" where X is already merged into main; remote branches
     already merged into main (safe to delete); remote branches with no commits in 30+ days.

Usage: python tools/map_check.py
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "docs" / "map"
NO_CONTEXT_OK = {"docs", ".claude", ".git", "node_modules"}  # docs has its own; .claude has skills/CONTEXT.md
problems, notes = [], []


def git(*args):
    r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def frontmatter(p):
    t = p.read_text()
    m = re.match(r"---\n(.*?)\n---\n", t, re.S)
    out = {}
    for line in (m.group(1).splitlines() if m else []):
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def main():
    if not MAP.exists():
        sys.exit("docs/map not found")

    # 1 twins
    base = (MAP / "CLAUDE.md").read_bytes()
    for twin in ("AGENTS.md", "routing.md"):
        if (MAP / twin).read_bytes() != base:
            problems.append(f"twin differs from CLAUDE.md: docs/map/{twin} (copy CLAUDE.md over it)")

    # 2 links and index
    cards = {p.stem: p for p in (MAP / "objects").glob("*/*.md")}
    procs = {p.stem: p for p in (MAP / "processes").glob("*.md")}
    known = set(cards) | set(procs)
    index = (MAP / "objects" / "_index.md").read_text()
    indexed = set(re.findall(r"^- ([a-z0-9-]+) \|", index, re.M))
    for md in MAP.rglob("*.md"):
        for link in re.findall(r"\[\[([^\]]+)\]\]", md.read_text()):
            if link not in known:
                problems.append(f"broken link [[{link}]] in {md.relative_to(ROOT)}")
    for slug in cards:
        if slug not in indexed:
            problems.append(f"card not in objects/_index.md: {slug}")
    for slug in indexed:
        if not re.search(rf"^- {slug} \| .*\| (stub|plan|verified)", index, re.M):
            problems.append(f"index line has no status: {slug}")

    # 3 and 4 entities and staleness
    for slug, p in sorted(cards.items()):
        fm = frontmatter(p)
        ent = fm.get("entity", "").split(" ")[0].strip('"')
        if fm.get("status") == "verified" and "/" in ent and not ent.startswith(("Twenty", "Retell", "branch")):
            path = ROOT / ent.rstrip("/")
            if not path.exists():
                problems.append(f"entity missing: {slug} -> {ent}")
                continue
            sha = fm.get("verified_at", "").split(" ")[0]
            if sha and git("cat-file", "-e", f"{sha}^{{commit}}") is not None:
                changed = git("diff", "--name-only", sha, "HEAD", "--", ent) or ""
                if changed:
                    problems.append(f"STALE card {slug}: {len(changed.splitlines())} file(s) under {ent} changed since {sha}")
            elif sha:
                notes.append(f"{slug}: verified_at {sha} not found locally; cannot check staleness")

    # 5 README decision range
    dec = (ROOT / "docs" / "decisions.md").read_text()
    top = max(int(n) for n in re.findall(r"^## D-(\d+)", dec, re.M))
    m = re.search(r"D-001 through D-(\d+)", (ROOT / "README.md").read_text())
    if m and int(m.group(1)) != top:
        problems.append(f"README says D-001 through D-{m.group(1)}; decisions.md reaches D-{top:03d}")

    # 6 folders with no CONTEXT.md
    for d in sorted(ROOT.iterdir()):
        if d.is_dir() and d.name not in NO_CONTEXT_OK and not d.name.startswith(".") and not (d / "CONTEXT.md").exists():
            problems.append(f"top-level folder without CONTEXT.md: {d.name}/")

    # 7 leftovers
    merged = {b for b in (git("branch", "-r", "--merged", "origin/main") or "").split() if b.startswith("origin/")}
    allb = [b.strip() for b in (git("branch", "-r") or "").splitlines() if "->" not in b]
    for doc in ("docs/progress.md", "KYNETIC_CONTEXT.md", "docs/known-issues.md"):
        txt = (ROOT / doc).read_text()
        for b in set(re.findall(r"`((?:claude|chore|feat)/[\w./-]+)`", txt)):
            if f"origin/{b}" in merged and re.search(rf"{re.escape(b)}[^.\n]{{0,80}}not merged", txt):
                problems.append(f"LEFTOVER: {doc} says branch {b} is not merged, but it is merged into main")
    done = sorted(b for b in merged if b not in ("origin/main", "origin/HEAD"))
    if done:
        notes.append(f"{len(done)} remote branches already merged into main (safe to delete): " + ", ".join(done[:8]) + (" ..." if len(done) > 8 else ""))
    old = []
    for b in allb:
        if b in merged:
            continue
        ts = git("log", "-1", "--format=%ct", b)
        if ts and (int(git("log", "-1", "--format=%ct", "HEAD") or 0) - int(ts)) > 30 * 86400:
            old.append(b)
    if old:
        notes.append(f"{len(old)} unmerged remote branches with no commit in 30+ days (decide: merge, keep, delete): " + ", ".join(old[:6]))

    for n in notes:
        print("note:", n)
    for p in problems:
        print("PROBLEM:", p)
    print(f"{len(problems)} problem(s), {len(notes)} note(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

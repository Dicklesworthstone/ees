#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is required on PATH" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required on PATH (https://github.com/astral-sh/uv)" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script from inside a git repository" >&2
  exit 1
fi

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Deploy from main so GitHub Pages has no separate publishing branch" >&2
  exit 1
fi

if ! git diff --cached --quiet; then
  echo "Commit or unstage existing staged changes before deploying" >&2
  exit 1
fi

REPO_URL="$(git config --get remote.origin.url || true)"
if [ -z "$REPO_URL" ]; then
  echo "No 'origin' remote found; set one with:" >&2
  echo "  git remote add origin git@github.com:USER/REPO.git" >&2
  exit 1
fi

if [ ! -f "epstein_emails_explorer.html" ]; then
  echo "epstein_emails_explorer.html not found in current directory" >&2
  exit 1
fi

if [ ! -f "build_epstein_index.py" ]; then
  echo "build_epstein_index.py not found in current directory" >&2
  exit 1
fi

if [ ! -f "pyproject.toml" ]; then
  echo "pyproject.toml not found; cannot install Python deps" >&2
  exit 1
fi

echo "Syncing Python dependencies via uv (pyproject.toml)..."
uv sync --frozen --python 3.13

echo "Building Epstein email metadata, timeline, people, threads, neighbors..."
uv run --frozen --python 3.13 build_epstein_index.py

if [ ! -f "data/meta.sqlite" ] || [ ! -f "data/text.pack" ]; then
  echo "build_epstein_index.py did not produce data/meta.sqlite and data/text.pack" >&2
  exit 1
fi

echo "Preparing the main-branch Pages files..."
cp epstein_emails_explorer.html index.html
touch .nojekyll
git add -- .gitignore epstein_emails_explorer.html index.html search-worker.js vendor deploy_gh_pages.sh README.md .nojekyll
git add -f -- data/meta.sqlite data/text.pack

if ! git diff --cached --quiet; then
  git commit \
    -m "deploy(pages): publish current explorer and data on main" \
    -m "Rebuild the public metadata database and text pack from the pinned corpus, then copy the current explorer UI to the Pages entry point. Keep the worker and vendored browser dependencies on the same mainline revision as the data they read. The static site is served directly from main; no separate publishing branch or forced history update is needed."
fi

git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/master:refs/remotes/origin/master
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "Remote main advanced or diverged; harmonize it before deploying" >&2
  exit 1
fi
git push --atomic origin main:main main:master

echo "Deployment pushed to main and master at $REPO_URL."
echo "GitHub Pages source: main / (root)."

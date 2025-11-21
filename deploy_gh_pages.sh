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

if ! command -v node >/dev/null 2>&1; then
  echo "node is required on PATH" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required on PATH" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this script from inside a git repository" >&2
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

if [ ! -f "build_search_index.js" ]; then
  echo "build_search_index.js not found in current directory" >&2
  exit 1
fi

if [ ! -f "pyproject.toml" ]; then
  echo "pyproject.toml not found; cannot install Python deps" >&2
  exit 1
fi

echo "Cleaning up previous virtual environment..."
rm -rf .venv

echo "Creating Python 3.13 virtual env with uv..."
uv venv --python 3.13 .venv

echo "Syncing Python dependencies via uv (pyproject.toml)..."
uv sync --python 3.13

echo "Ensuring npm dependencies are installed..."
if [ ! -f package.json ]; then
  cat > package.json << 'EOF'
{
  "name": "epstein-emails-explorer",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "flexsearch": "^0.8.2"
  }
}
EOF
fi

npm install

echo "Building Epstein email metadata, timeline, people, threads, neighbors..."
uv run --python 3.13 build_epstein_index.py

if [ ! -f "data/meta.sqlite" ] || [ ! -f "data/text.pack" ]; then
  echo "build_epstein_index.py did not produce data/meta.sqlite and data/text.pack" >&2
  exit 1
fi

echo "Skipping prebuilt index (worker builds at runtime)."

BUILD_DIR=".gh-pages-build"
echo "Preparing build directory: $BUILD_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/data"
mkdir -p "$BUILD_DIR/vendor"

cp epstein_emails_explorer.html "$BUILD_DIR/index.html"
cp data/meta.sqlite "$BUILD_DIR/data/meta.sqlite"
cp data/text.pack "$BUILD_DIR/data/text.pack"
cp search-worker.js "$BUILD_DIR/search-worker.js"
cp vendor/* "$BUILD_DIR/vendor/"
touch "$BUILD_DIR/.nojekyll"

cd "$BUILD_DIR"

git init >/dev/null 2>&1
git add index.html .nojekyll data search-worker.js vendor
git commit -m "Deploy Epstein Emails Explorer" >/dev/null 2>&1
git branch -M gh-pages

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "Pushing to gh-pages branch on $REPO_URL ..."
git push --force origin gh-pages

echo
echo "Deployment complete."
echo "In the GitHub repo settings, set Pages source to:"
echo "  Branch: gh-pages   Folder: / (root)"

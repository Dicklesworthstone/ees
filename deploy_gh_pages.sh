#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is required on PATH" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "python3 or python is required on PATH" >&2
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

echo "Ensuring Python dependencies are installed..."
"$PYTHON" - << 'EOF'
import subprocess, sys
pkgs = ["datasets", "python-dateutil", "scikit-learn", "sentence-transformers"]
for p in pkgs:
    try:
        __import__(p.split("-")[0])
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", p])
EOF

echo "Ensuring npm dependencies are installed..."
if [ ! -f package.json ]; then
  cat > package.json << 'EOF'
{
  "name": "epstein-emails-explorer",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "flexsearch": "^0.8.2"
  },
  "scripts": {
    "build:index": "node build_search_index.js"
  }
}
EOF
fi

npm install

echo "Building Epstein email metadata, timeline, people, threads, neighbors..."
"$PYTHON" build_epstein_index.py

if [ ! -f "data/meta.json" ]; then
  echo "build_epstein_index.py did not produce data/meta.json" >&2
  exit 1
fi

echo "Building precomputed FlexSearch index..."
npm run build:index

if [ ! -f "data/index-export.json" ]; then
  echo "build_search_index.js did not produce data/index-export.json" >&2
  exit 1
fi

BUILD_DIR=".gh-pages-build"
echo "Preparing build directory: $BUILD_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp epstein_emails_explorer.html "$BUILD_DIR/index.html"
cp -r data "$BUILD_DIR/data"
cp -r docs "$BUILD_DIR/docs"
cp search-worker.js "$BUILD_DIR/search-worker.js"
touch "$BUILD_DIR/.nojekyll"

cd "$BUILD_DIR"

git init >/dev/null 2>&1
git add index.html .nojekyll data docs search-worker.js
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


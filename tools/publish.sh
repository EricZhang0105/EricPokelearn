#!/usr/bin/env bash
# PokeLearn 一键发布：校验仓库 → 提交 → push → GitHub Pages 自动更新
# 用法：bash tools/publish.sh "这次更新的一句话说明"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXPECTED="ericzhang0105/EricPokelearn"
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE" != *"$EXPECTED"* ]]; then
  echo "STOP: origin 不是 $EXPECTED（当前：$REMOTE）" >&2
  echo "请在正确的仓库里发布，否则链接会指向错误的地方。" >&2
  exit 1
fi

MSG="${1:-PokeLearn update $(date +%Y-%m-%d)}"
git add -A
if git diff --cached --quiet; then
  echo "没有待提交的改动，无需发布。"
else
  git commit -m "$MSG"
fi

git pull --rebase origin main
git push origin main

echo ""
echo "DONE: 已推送到 $EXPECTED"
echo "永久主链接（1–2 分钟后自动更新）：https://ericzhang0105.github.io/EricPokelearn/"

#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Workhorse Station - 更新脚本
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "[1/4] 拉取最新代码..."
git pull

echo "[2/4] 安装依赖..."
pnpm install --frozen-lockfile

echo "[3/4] 构建项目..."
pnpm build

echo "[4/4] 重启服务..."
systemctl --user restart workhorse-station

sleep 2

if systemctl --user is-active --quiet workhorse-station; then
  echo ""
  echo "更新完成，服务已重启"
  echo "访问: http://localhost:3001"
else
  echo ""
  echo "警告: 服务启动失败，请查看日志:"
  echo "  journalctl --user -u workhorse-station -n 50"
fi

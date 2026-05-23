#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "  Workhorse Station 卸载脚本"
echo "=========================================="
echo ""

# 停止并禁用服务
echo "停止并禁用服务..."
systemctl --user stop workhorse-station 2>/dev/null || true
systemctl --user disable workhorse-station 2>/dev/null || true

# 删除 service 文件
SERVICE_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/workhorse-station.service"
if [ -f "$SERVICE_FILE" ]; then
  rm "$SERVICE_FILE"
  echo "已删除服务文件: $SERVICE_FILE"
fi
systemctl --user daemon-reload

echo ""
echo "服务已卸载。"

read -rp "是否同时删除项目目录？(y/n) " DELETE_DIR
if [ "$DELETE_DIR" = "y" ] || [ "$DELETE_DIR" = "Y" ]; then
  echo "删除项目目录: $PROJECT_DIR"
  rm -rf "$PROJECT_DIR"
  echo "项目目录已删除"
else
  echo "项目目录保留: $PROJECT_DIR"
fi

echo ""
echo "卸载完成"

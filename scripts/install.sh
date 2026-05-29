#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Workhorse Station - 一键安装脚本
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "  Workhorse Station 安装脚本"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR"
echo ""

# ---------- 1. 检查前置条件 ----------
echo "[1/7] 检查前置条件..."

if ! command -v node &>/dev/null; then
  echo "错误: 未找到 Node.js，请先安装 Node.js >= 18"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "错误: Node.js 版本过低 (当前: $(node -v))，需要 >= 18"
  exit 1
fi
echo "  Node.js $(node -v) ✓"

if ! command -v pnpm &>/dev/null; then
  echo "  pnpm 未安装，正在通过 corepack 启用..."
  corepack enable
  if ! command -v pnpm &>/dev/null; then
    echo "错误: pnpm 启用失败，请手动安装 pnpm"
    exit 1
  fi
fi
echo "  pnpm $(pnpm -v) ✓"

# ---------- 2. 配置环境变量 ----------
echo "[2/7] 配置环境变量..."

if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "  已从 .env.example 创建 .env 文件"
  echo ""
  echo "  ⚠ 请编辑 .env 文件配置运行参数和 Anthropic API 密钥:"
  echo "    $PROJECT_DIR/.env"
  echo ""
  read -rp "  是否现在编辑 .env 文件？(y/n) " EDIT_ENV
  if [ "$EDIT_ENV" = "y" ] || [ "$EDIT_ENV" = "Y" ]; then
    ${EDITOR:-nano} "$PROJECT_DIR/.env"
  fi
else
  echo "  .env 文件已存在，跳过"
fi

# ---------- 3. 安装依赖 ----------
echo "[3/7] 安装依赖..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile

# ---------- 4. 构建项目 ----------
echo "[4/7] 构建项目..."
pnpm build

# ---------- 5. 注册 systemd 服务 ----------
echo "[5/7] 注册 systemd 用户服务..."

SERVICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$SERVICE_DIR"

SERVICE_FILE="$SERVICE_DIR/workhorse-station.service"
USER_RUNTIME_DIR="/run/user/$(id -u)"
sed -e "s|PROJECT_ROOT|$PROJECT_DIR|g" -e "s|USER_RUNTIME_DIR|$USER_RUNTIME_DIR|g" "$SCRIPT_DIR/workhorse-station.service" > "$SERVICE_FILE"
echo "  服务文件已创建: $SERVICE_FILE"

# ---------- 6. 启用开机自启 ----------
echo "[6/7] 启用开机自启..."

# 确保用户服务可以在开机时启动（不需要用户先登录）
if command -v loginctl &>/dev/null; then
  loginctl enable-linger "$USER" 2>/dev/null || true
fi

systemctl --user daemon-reload
systemctl --user enable workhorse-station

# ---------- 7. 启动服务 ----------
echo "[7/7] 启动服务..."
systemctl --user start workhorse-station

sleep 2

if systemctl --user is-active --quiet workhorse-station; then
  echo ""
  echo "=========================================="
  echo "  安装完成！"
  echo "=========================================="
  echo ""
  echo "  访问地址: http://localhost:3001"
  echo ""
  echo "  管理命令（在项目目录下执行）:"
  echo "    bash scripts/update.sh   更新到最新版本"
  echo "    bash scripts/start.sh    启动服务"
  echo "    bash scripts/stop.sh     停止服务"
  echo "    bash scripts/restart.sh  重启服务"
  echo "    bash scripts/status.sh   查看状态"
  echo "    bash scripts/uninstall.sh 卸载"
  echo ""
else
  echo ""
  echo "=========================================="
  echo "  安装完成，但服务启动失败"
  echo "=========================================="
  echo ""
  echo "  请运行以下命令查看日志:"
  echo "    systemctl --user status workhorse-station"
  echo "    journalctl --user -u workhorse-station -n 50"
  echo ""
fi

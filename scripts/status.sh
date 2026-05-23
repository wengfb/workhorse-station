#!/usr/bin/env bash
set -euo pipefail
echo "Workhorse Station 服务状态:"
echo ""
systemctl --user status workhorse-station --no-pager || true
echo ""
echo "最近日志:"
journalctl --user -u workhorse-station -n 20 --no-pager

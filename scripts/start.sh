#!/usr/bin/env bash
set -euo pipefail
systemctl --user start workhorse-station
echo "Workhorse Station 已启动"
systemctl --user status workhorse-station --no-pager

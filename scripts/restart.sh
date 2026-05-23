#!/usr/bin/env bash
set -euo pipefail
systemctl --user restart workhorse-station
echo "Workhorse Station 已重启"
systemctl --user status workhorse-station --no-pager

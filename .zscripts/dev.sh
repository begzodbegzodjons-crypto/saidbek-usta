#!/bin/bash
# QurilPro — kontener har ishga tushganda serverni TiDB bazasi bilan ko'tarish
# start.sh tomonidan `sudo -u z bash .zscripts/dev.sh` bilan chaqiriladi.
set -e
cd /home/z/my-project

# 1) start.sh .env ni sqlite URL ga qayta yozadi — biz uni TiDB ga qaytaramiz
# (kredensiallar restartda saqlanadigan upload/ mountida)
if [ -f /home/z/my-project/upload/.tidb.env ]; then
  cp /home/z/my-project/upload/.tidb.env /home/z/my-project/.env
  chown z:z /home/z/my-project/.env 2>/dev/null || true
  echo "[dev.sh] .env TiDB URL bilan tiklandi"
fi

# 2) Bog'liqliklar va Prisma klient (jarayon tez bo'lishi uchun tekshirilib)
if [ ! -d node_modules ]; then
  echo "[dev.sh] bun install..."
  bun install
fi
if [ ! -f node_modules/.prisma/client/index.js ] || ! grep -q mysql node_modules/.prisma/client/schema.prisma 2>/dev/null; then
  echo "[dev.sh] prisma generate..."
  set -a; source .env; set +a
  ./node_modules/.bin/prisma generate >/dev/null 2>&1 || true
fi

# 3) Eski serverni to'xtatish
pkill -f "next dev" 2>/dev/null || true
sleep 1

# 4) Serverni userns (unshare) ichida ishga tushirish — sessiya yopilganda
# o'chib qolmasligi uchun (fork PDEATHSIG ni tozalaydi)
set -a; source .env; set +a
unshare --user --map-root-user --fork bash -c 'cd /home/z/my-project && setsid nohup ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown; sleep 1' >/tmp/devsh-unshare.log 2>&1 </dev/null &
UNSH_PID=$!
disown $UNSH_PID 2>/dev/null || true

# 5) Server tayyor bo'lguncha kutish
for i in $(seq 1 30); do
  if curl -s --connect-timeout 2 --max-time 4 http://localhost:3000 > /dev/null 2>&1; then
    echo "[dev.sh] QurilPro server tayyor (TiDB bazasi bilan)"
    exit 0
  fi
  sleep 2
done
echo "[dev.sh] Server 60s ichida tayyor bolmadi — loglarni tekshiring: dev.log"
exit 1

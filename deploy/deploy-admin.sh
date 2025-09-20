#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/var/www/admin
REPO_URL=https://github.com/JoseeGarciaa/kryotec-Admin.git
BRANCH=main
SERVICE=kryotec-admin.service

if [ ! -d "$APP_DIR/.git" ]; then
  echo "[INFO] Clonando repo inicial..."
  rm -rf "$APP_DIR" && mkdir -p "$APP_DIR"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
echo "[INFO] Fetch + reset a origen/$BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[INFO] Instalando dependencias"
npm install --production=false

echo "[INFO] Build frontend"
npm run build

echo "[INFO] Reiniciando servicio systemd"
systemctl daemon-reload || true
systemctl restart kryotec-admin || systemctl start kryotec-admin
systemctl status kryotec-admin --no-pager -n 5 || true

echo "[DONE] Despliegue completado"
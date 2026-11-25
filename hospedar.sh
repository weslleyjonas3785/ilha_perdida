#!/bin/sh
# Linux / macOS: inicia o servidor do mundo multiplayer
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Instale o Node.js (https://nodejs.org) e rode de novo."; exit 1; }
node server.mjs

#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use v22.23.1
cd /Users/a1-6/.codely/Default/zk-battleship-aleo/web-app
exec node node_modules/vite/bin/vite.js --port 5173 --host

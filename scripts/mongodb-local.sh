#!/usr/bin/env bash
# Start the local MongoDB (port 27017) if it is not already running.
# Used by @reboot crontab and by hand:  bash scripts/mongodb-local.sh
set -u
BIN=/home/ahsanhabibhamim/mongodb/bin
MONGOD=/home/ahsanhabibhamim/mongodb/bin/mongod
DATA=/home/ahsanhabibhamim/kintech-mongodata
LOG=/home/ahsanhabibhamim/kintech-mongo.log

if [ -x "/usr/bin/mongod" ]; then
  MONGOD=/usr/bin/mongod
fi

if pgrep -f "mongod.*kintech-mongodata" >/dev/null 2>&1; then
  echo "[mongodb-local] mongod already running (kintech-mongodata)"
else
  mkdir -p "$DATA"
  "$MONGOD" --dbpath "$DATA" --port 27017 --bind_ip 127.0.0.1 --replSet rs0 --fork --logpath "$LOG"
  echo "[mongodb-local] mongod started (port 27017, replSet rs0, data: $DATA, log: $LOG)"
  # Wait for mongod to accept connections, then initiate the single-node replica set
  # (required for multi-document transactions on this standalone server).
  export NODE_PATH=/home/ahsanhabibhamim/CRM.KinTech/node_modules
  for i in $(seq 1 30); do
    if node -e "
      const {MongoClient}=require('mongodb');
      const c=new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true',{serverSelectionTimeoutMS:1000});
      c.connect().then(async()=>{await c.db('admin').command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}}).catch(()=>{});await c.close();process.exit(0);}).catch(()=>process.exit(1));
    " 2>/dev/null; then
      break
    fi
    sleep 1
  done
fi
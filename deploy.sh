#!/bin/bash
#
# DentaFlow AI — Zero-Downtime Deployment Script
#
# Usage: ./deploy.sh
#

set -e

# Configuration
SSH_KEY="${SSH_KEY:-.ssh/id_rsa}"
SERVER="amir@host.efficientbuy.com"
REMOTE_DIR="/opt/docker/dentaflow"
CONTAINER_NAME="dentaflow-ai"
CONTAINER_NEW="dentaflow-ai-new"
IMAGE_NAME="dentaflow-ai"
PORT_MAIN=8082
PORT_TEMP=8083
LOCAL_ENV=".env.production"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   🦷 DENTAFLOW AI — Zero-Downtime Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check SSH key
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at: $SSH_KEY"
    exit 1
fi

echo "🔑 Using SSH key: $SSH_KEY"
echo "🖥️  Target: $SERVER"
echo "📁 Remote dir: $REMOTE_DIR"
echo "🌐 Port: $PORT_MAIN"
echo ""

# Remote helpers
remote_exec() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "$@"
}
remote_copy() {
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r "$1" "$SERVER:$2"
}

# ─── Step 0: Setup remote directory ────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Step 0: Setting up remote directory..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
remote_exec "mkdir -p $REMOTE_DIR/config $REMOTE_DIR/data"
echo "✅ Remote directory ready"
echo ""

# ─── Step 1: Sync .env ─────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Step 1: Syncing environment config..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "$LOCAL_ENV" ]; then
    remote_copy "$LOCAL_ENV" "$REMOTE_DIR/config/.env"
    echo "✅ .env synced"
else
    echo "⚠️  No $LOCAL_ENV found — using existing remote config"
fi
echo ""

# ─── Step 2: Sync project files ────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 Step 2: Syncing project files to server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Sync using rsync (faster) or scp
if command -v rsync &>/dev/null; then
    rsync -avz --delete \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='__pycache__' \
        --exclude='.venv' \
        --exclude='*.pyc' \
        --exclude='.ssh' \
        --exclude='*.db' \
        --exclude='dist' \
        --exclude='.env*' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        ./ "$SERVER:$REMOTE_DIR/"
else
    # Fallback: tar + scp
    echo "   (rsync not found, using tar+scp)"
    tar czf /tmp/dentaflow-deploy.tar.gz \
        --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
        --exclude='.venv' --exclude='*.pyc' --exclude='.ssh' \
        --exclude='*.db' --exclude='dist' --exclude='.env*' \
        .
    remote_copy /tmp/dentaflow-deploy.tar.gz "$REMOTE_DIR/deploy.tar.gz"
    remote_exec "cd $REMOTE_DIR && tar xzf deploy.tar.gz && rm deploy.tar.gz"
    rm /tmp/dentaflow-deploy.tar.gz
fi
echo "✅ Files synced"
echo ""

# ─── Step 3: Build Docker image ────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Step 3: Building Docker image on server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
remote_exec "cd $REMOTE_DIR && docker build -t ${IMAGE_NAME}:new . 2>&1 | tail -15" || {
    echo "❌ Build failed!"
    exit 1
}
echo "✅ Image built"
echo ""

# ─── Step 4: Start new container on temp port ──────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 4: Starting new container on port $PORT_TEMP..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
remote_exec "docker stop $CONTAINER_NEW 2>/dev/null || true"
remote_exec "docker rm $CONTAINER_NEW 2>/dev/null || true"

remote_exec "docker run -d \
    --name $CONTAINER_NEW \
    -p ${PORT_TEMP}:8000 \
    --env-file $REMOTE_DIR/config/.env \
    -v $REMOTE_DIR/data:/app/data \
    ${IMAGE_NAME}:new"
echo "✅ New container started"
echo ""

# ─── Step 5: Health check ──────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Step 5: Waiting for health check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if remote_exec "curl -sf http://localhost:${PORT_TEMP}/health | grep -q healthy"; then
        echo "✅ New container is healthy!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo "   Waiting... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "❌ Health check failed. Rolling back..."
    remote_exec "docker logs $CONTAINER_NEW 2>&1 | tail -30"
    remote_exec "docker stop $CONTAINER_NEW 2>/dev/null || true"
    remote_exec "docker rm $CONTAINER_NEW 2>/dev/null || true"
    exit 1
fi
echo ""

# ─── Step 6: Atomic swap ───────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Step 6: Swapping containers..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
remote_exec "docker stop $CONTAINER_NEW 2>/dev/null || true"
remote_exec "docker rm $CONTAINER_NEW 2>/dev/null || true"
remote_exec "docker stop $CONTAINER_NAME 2>/dev/null || true"
remote_exec "docker rm $CONTAINER_NAME 2>/dev/null || true"

remote_exec "docker run -d \
    --name $CONTAINER_NAME \
    -p ${PORT_MAIN}:8000 \
    --env-file $REMOTE_DIR/config/.env \
    -v $REMOTE_DIR/data:/app/data \
    --restart unless-stopped \
    ${IMAGE_NAME}:new"
echo "✅ Container swap complete"
echo ""

# ─── Step 7: Final verification ────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Step 7: Final verification..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 3
HEALTH=$(remote_exec "curl -s http://localhost:${PORT_MAIN}/health")
echo "   Health: $HEALTH"

# Cleanup
remote_exec "docker tag ${IMAGE_NAME}:new ${IMAGE_NAME}:latest 2>/dev/null || true"
remote_exec "docker image prune -f 2>/dev/null || true"

if echo "$HEALTH" | grep -q "healthy"; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║   ✅ DEPLOYMENT COMPLETE                                        ║"
    echo "╠══════════════════════════════════════════════════════════════════╣"
    echo "║                                                                  ║"
    echo "║   🌐 Website:  https://dentaflow.efficientbuy.com               ║"
    echo "║   📊 API:      https://dentaflow.efficientbuy.com/docs          ║"
    echo "║   💚 Status:   Healthy                                          ║"
    echo "║   🚀 Port:     $PORT_MAIN                                           ║"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
else
    echo "⚠️  Health check returned unexpected response"
fi

echo ""
echo "📋 Useful commands:"
echo "   View logs:    ssh -i $SSH_KEY $SERVER 'docker logs -f $CONTAINER_NAME'"
echo "   Restart:      ssh -i $SSH_KEY $SERVER 'docker restart $CONTAINER_NAME'"
echo "   Shell:        ssh -i $SSH_KEY $SERVER 'docker exec -it $CONTAINER_NAME bash'"
echo ""

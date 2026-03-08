# websocket.py — WebSocket endpoint for real-time case status updates.

import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections per user."""

    def __init__(self) -> None:
        self.connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Accept and register a new connection."""
        await websocket.accept()
        self.connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        """Remove a closed connection."""
        if user_id in self.connections:
            self.connections[user_id] = [
                ws for ws in self.connections[user_id] if ws != websocket
            ]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def send_to_user(
        self, user_id: str, event_type: str,
        case_id: str | None = None,
        case_number: str | None = None,
        message: str = "",
    ) -> None:
        """Broadcast an event to all tabs of a specific user."""
        payload = json.dumps({
            "type": event_type,
            "case_id": case_id,
            "case_number": case_number,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        dead: list[WebSocket] = []
        for ws in self.connections.get(user_id, []):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(
        self, event_type: str, message: str,
        case_id: str | None = None,
        case_number: str | None = None,
    ) -> None:
        """Send an event to all connected users."""
        for user_id in list(self.connections.keys()):
            await self.send_to_user(
                user_id, event_type, case_id, case_number, message
            )


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> None:
    """WebSocket connection handler for real-time updates."""
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

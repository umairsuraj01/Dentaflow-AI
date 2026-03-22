// REACT NATIVE: Has DOM dependencies (window.location, WebSocket constructor). Needs RN adapter.
// useWebSocket.ts — Hook for real-time WebSocket updates with auto-reconnect.

import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketEvent {
  type: string;
  case_id: string | null;
  case_number: string | null;
  message: string;
  timestamp: string;
}

export function useWebSocket(userId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!userId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/ws/${userId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        setLastEvent(data);
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      setIsConnected(false);
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, [userId]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  return { lastEvent, isConnected };
}

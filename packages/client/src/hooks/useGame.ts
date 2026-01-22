/**
 * useGame Hook - Handles game connection and real-time sync
 */

import { useEffect, useRef, useCallback } from 'react';
import { api, GameWebSocket } from '../api';
import { useGameStore } from '../stores';

export function useGame() {
  const wsRef = useRef<GameWebSocket | null>(null);
  
  const gameId = useGameStore((state) => state.gameId);
  const isLoading = useGameStore((state) => state.isLoading);
  const error = useGameStore((state) => state.error);
  const initializeGame = useGameStore((state) => state.initializeGame);
  const advanceTick = useGameStore((state) => state.advanceTick);
  const addNewsItem = useGameStore((state) => state.addNewsItem);
  const addEvent = useGameStore((state) => state.addEvent);

  // Connect to WebSocket when game is initialized
  useEffect(() => {
    if (!gameId) return;

    const ws = new GameWebSocket(gameId);
    wsRef.current = ws;

    ws.connect()
      .then(() => {
        console.log('Connected to game WebSocket');
      })
      .catch((err) => {
        console.error('Failed to connect WebSocket:', err);
      });

    // Listen for game state updates
    ws.on('tick', (data) => {
      const tickData = data as { tick: number };
      advanceTick(tickData.tick);
    });

    ws.on('event', (data) => {
      const eventData = data as { event: { id: string; type: string; title: string; description: string } };
      addNewsItem(eventData.event.title);
      // addEvent(eventData.event);
    });

    ws.on('market_update', (data) => {
      console.log('Market update:', data);
      // Update market summaries
    });

    ws.on('pong', () => {
      console.log('WebSocket pong received');
    });

    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      ws.ping();
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      ws.disconnect();
      wsRef.current = null;
    };
  }, [gameId, advanceTick, addNewsItem, addEvent]);

  // Create a new game
  const createGame = useCallback(async (name: string, companyName: string) => {
    const result = await api.createGame(name, companyName);
    if (result.data) {
      await initializeGame(result.data.id);
    }
    return result;
  }, [initializeGame]);

  // Load existing game
  const loadGame = useCallback(async (id: string) => {
    await initializeGame(id);
  }, [initializeGame]);

  return {
    gameId,
    isLoading,
    error,
    createGame,
    loadGame,
    ws: wsRef.current,
  };
}
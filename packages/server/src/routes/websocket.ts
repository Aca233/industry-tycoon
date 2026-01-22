/**
 * WebSocket Routes for real-time game communication
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket as WSWebSocket } from '@fastify/websocket';
import { gameLoop, TickUpdate } from '../services/gameLoop.js';

interface WSClient {
  socket: WSWebSocket;
  gameId: string;
}

// Track connected clients
const clients: Map<string, Set<WSClient>> = new Map();

export async function websocketRoutes(app: FastifyInstance) {
  // WebSocket upgrade handler
  app.get('/ws/game/:gameId', { websocket: true }, (socket: WSWebSocket, request: FastifyRequest) => {
    const params = request.params as { gameId: string };
    const gameId = params.gameId;
    
    console.log(`[WS] Client connected to game: ${gameId}`);
    
    // Add client to tracking
    if (!clients.has(gameId)) {
      clients.set(gameId, new Set());
    }
    const client: WSClient = { socket, gameId };
    clients.get(gameId)!.add(client);
    
    // Initialize or get game
    const game = gameLoop.getOrCreateGame(gameId);
    
    // Send initial state with playerCash for immediate UI sync
    socket.send(JSON.stringify({
      type: 'init',
      payload: {
        gameId: game.id,
        currentTick: game.currentTick,
        speed: game.speed,
        isPaused: game.isPaused,
        playerCash: game.playerCash,
        buildingCount: game.buildings.length,
      },
    }));
    
    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as {
          type: string;
          payload?: Record<string, unknown>;
        };
        
        console.log(`[WS] Received:`, message);
        
        switch (message.type) {
          case 'setSpeed': {
            const speed = (message.payload?.speed as number) ?? 1;
            gameLoop.setSpeed(gameId, speed as 0 | 1 | 2 | 4);
            break;
          }
          
          case 'togglePause': {
            const isPaused = gameLoop.togglePause(gameId);
            const gameState = gameLoop.getGame(gameId);
            broadcast(gameId, {
              type: 'pauseChange',
              payload: {
                isPaused,
                speed: gameState?.speed ?? 0,
              },
            });
            break;
          }
          
          case 'purchaseBuilding': {
            // 支持两种参数名: buildingDefId (新) 或 buildingId (旧)
            const buildingDefId = (message.payload?.buildingDefId ?? message.payload?.buildingId) as string;
            if (buildingDefId) {
              const result = gameLoop.purchaseBuilding(gameId, buildingDefId);
              socket.send(JSON.stringify({
                type: 'purchaseResult',
                payload: result,
              }));
              
              if (result.success) {
                // Broadcast building update to all clients
                broadcast(gameId, {
                  type: 'buildingAdded',
                  payload: {
                    building: result.building,
                    playerCash: result.newCash,
                  },
                });
              }
            }
            break;
          }
          
          case 'getBuildings': {
            const buildings = gameLoop.getBuildings(gameId);
            const cash = gameLoop.getPlayerCash(gameId);
            socket.send(JSON.stringify({
              type: 'buildingsData',
              payload: {
                buildings,
                playerCash: cash,
              },
            }));
            break;
          }
          
          case 'resetGame': {
            const newGame = gameLoop.resetGame(gameId);
            if (newGame) {
              // Broadcast reset to all clients
              broadcast(gameId, {
                type: 'gameReset',
                payload: {
                  gameId: newGame.id,
                  currentTick: newGame.currentTick,
                  speed: newGame.speed,
                  isPaused: newGame.isPaused,
                  playerCash: newGame.playerCash,
                },
              });
            }
            break;
          }
          
          case 'switchMethod': {
            const buildingId = message.payload?.buildingId as string;
            const methodId = message.payload?.methodId as string;
            if (buildingId && methodId) {
              const result = gameLoop.switchBuildingMethod(gameId, buildingId, methodId);
              socket.send(JSON.stringify({
                type: 'switchMethodResult',
                payload: { ...result, buildingId, methodId },
              }));
              
              if (result.success) {
                // Broadcast method change to all clients
                broadcast(gameId, {
                  type: 'methodChanged',
                  payload: { buildingId, methodId },
                });
              }
            }
            break;
          }
          
          case 'ping': {
            socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          }
        }
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    });
    
    // Handle disconnect
    socket.on('close', () => {
      console.log(`[WS] Client disconnected from game: ${gameId}`);
      clients.get(gameId)?.delete(client);
      
      // Clean up empty game rooms
      if (clients.get(gameId)?.size === 0) {
        clients.delete(gameId);
        // Optionally pause game when no clients connected
        // gameLoop.setSpeed(gameId, 0);
      }
    });
    
    socket.on('error', (error: Error) => {
      console.error(`[WS] Socket error:`, error);
    });
  });
}

/**
 * Broadcast a message to all clients in a game
 */
function broadcast(gameId: string, message: object): void {
  const gameClients = clients.get(gameId);
  if (!gameClients) return;
  
  const data = JSON.stringify(message);
  
  for (const client of gameClients) {
    // readyState 1 = OPEN
    if (client.socket.readyState === 1) {
      client.socket.send(data);
    }
  }
}

/**
 * Initialize GameLoop event listeners for broadcasting
 */
export function initGameLoopBroadcast(): void {
  // Broadcast tick updates
  gameLoop.on('tick', (update: TickUpdate) => {
    broadcast(update.gameId, {
      type: 'tick',
      payload: update,
    });
  });
  
  // Broadcast speed changes
  gameLoop.on('speedChange', (data: { gameId: string; speed: number; isPaused: boolean }) => {
    broadcast(data.gameId, {
      type: 'speedChange',
      payload: {
        speed: data.speed,
        isPaused: data.isPaused,
      },
    });
  });
  
  // Broadcast pause changes
  gameLoop.on('pauseChange', (data: { gameId: string; isPaused: boolean; speed: number }) => {
    broadcast(data.gameId, {
      type: 'pauseChange',
      payload: {
        isPaused: data.isPaused,
        speed: data.speed,
      },
    });
  });
  
  console.log('[WS] GameLoop broadcast initialized');
}
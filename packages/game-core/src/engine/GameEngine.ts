/**
 * GameEngine - Core game loop and state management
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  type GameState,
  type GameTick,
  type StateUpdate,
  type StateDelta,
  GameSpeed,
  UpdateType,
  TIME_CONSTANTS,
} from '@scc/shared';

/** Engine events */
export interface GameEngineEvents {
  'tick': (tick: GameTick) => void;
  'stateUpdate': (update: StateUpdate) => void;
  'speedChange': (speed: GameSpeed) => void;
  'pause': () => void;
  'resume': () => void;
  'error': (error: Error) => void;
}

/** Engine configuration */
export interface GameEngineConfig {
  tickRate?: number; // Base ticks per second at normal speed
  maxTicksPerFrame?: number; // Prevent spiral of death
  enableDebugLogging?: boolean;
}

/** Subsystem interface - all game systems implement this */
export interface GameSubsystem {
  name: string;
  initialize(engine: GameEngine): Promise<void>;
  update(tick: GameTick, deltaTime: number): void;
  cleanup(): void;
}

/**
 * Core game engine that manages the game loop and coordinates subsystems
 */
export class GameEngine extends EventEmitter<GameEngineEvents> {
  private state: GameState | null = null;
  private subsystems: Map<string, GameSubsystem> = new Map();
  private isRunning = false;
  private lastTickTime = 0;
  private accumulatedTime = 0;
  private animationFrameId: number | null = null;
  private pendingUpdates: StateUpdate[] = [];
  
  private readonly config: Required<GameEngineConfig>;

  constructor(config: GameEngineConfig = {}) {
    super();
    this.config = {
      tickRate: 1000 / TIME_CONSTANTS.MS_PER_TICK_NORMAL,
      maxTicksPerFrame: 10,
      enableDebugLogging: false,
      ...config,
    };
  }

  /**
   * Initialize the engine with a game state
   */
  async initialize(initialState: GameState): Promise<void> {
    this.state = initialState;
    this.log('Initializing game engine...');
    
    // Initialize all subsystems
    for (const subsystem of this.subsystems.values()) {
      this.log(`Initializing subsystem: ${subsystem.name}`);
      await subsystem.initialize(this);
    }
    
    this.log('Game engine initialized');
  }

  /**
   * Register a subsystem
   */
  registerSubsystem(subsystem: GameSubsystem): void {
    if (this.subsystems.has(subsystem.name)) {
      throw new Error(`Subsystem ${subsystem.name} already registered`);
    }
    this.subsystems.set(subsystem.name, subsystem);
    this.log(`Registered subsystem: ${subsystem.name}`);
  }

  /**
   * Get a registered subsystem
   */
  getSubsystem<T extends GameSubsystem>(name: string): T | undefined {
    return this.subsystems.get(name) as T | undefined;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;
    if (!this.state) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }
    
    this.isRunning = true;
    this.lastTickTime = performance.now();
    this.accumulatedTime = 0;
    this.scheduleNextFrame();
    this.emit('resume');
    this.log('Game loop started');
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.emit('pause');
    this.log('Game loop stopped');
  }

  /**
   * Set game speed
   */
  setSpeed(speed: GameSpeed): void {
    if (!this.state) return;
    this.state.gameSpeed = speed;
    this.emit('speedChange', speed);
    this.log(`Speed changed to: ${speed}`);
  }

  /**
   * Get current game state (readonly)
   */
  getState(): Readonly<GameState> | null {
    return this.state;
  }

  /**
   * Get current tick
   */
  getCurrentTick(): GameTick {
    return this.state?.currentTick ?? 0;
  }

  /**
   * Apply a state update
   */
  applyUpdate(update: Omit<StateUpdate, 'tick' | 'timestamp'>): void {
    if (!this.state) return;
    
    const fullUpdate: StateUpdate = {
      ...update,
      tick: this.state.currentTick,
      timestamp: Date.now(),
    };
    
    this.pendingUpdates.push(fullUpdate);
    this.emit('stateUpdate', fullUpdate);
  }

  /**
   * Get and clear pending updates (for sync)
   */
  flushUpdates(): StateUpdate[] {
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];
    return updates;
  }

  /**
   * Create a state delta between two ticks
   */
  createDelta(fromTick: GameTick, toTick: GameTick): StateDelta {
    // This would be implemented with proper state tracking
    return {
      fromTick,
      toTick,
      updates: this.pendingUpdates.filter(
        (u) => u.tick >= fromTick && u.tick <= toTick
      ),
    };
  }

  /**
   * Main game loop frame
   */
  private gameLoop = (currentTime: number): void => {
    if (!this.isRunning || !this.state) return;

    try {
      const deltaTime = currentTime - this.lastTickTime;
      this.lastTickTime = currentTime;

      // Only accumulate time if not paused
      if (this.state.gameSpeed !== GameSpeed.Paused) {
        // Adjust for game speed
        const speedMultiplier = this.getSpeedMultiplier(this.state.gameSpeed);
        this.accumulatedTime += deltaTime * speedMultiplier;
      }

      // Fixed timestep for game logic
      const msPerTick = TIME_CONSTANTS.MS_PER_TICK_NORMAL;
      let ticksThisFrame = 0;

      while (
        this.accumulatedTime >= msPerTick &&
        ticksThisFrame < this.config.maxTicksPerFrame
      ) {
        this.processTick();
        this.accumulatedTime -= msPerTick;
        ticksThisFrame++;
      }

      // Prevent accumulator from growing too large
      if (this.accumulatedTime > msPerTick * this.config.maxTicksPerFrame) {
        this.accumulatedTime = 0;
        this.log('Warning: Tick accumulator reset due to lag');
      }
    } catch (error) {
      this.emit('error', error as Error);
      this.log(`Error in game loop: ${String(error)}`);
    }

    this.scheduleNextFrame();
  };

  /**
   * Process a single game tick
   */
  private processTick(): void {
    if (!this.state) return;

    // Advance tick counter
    this.state.currentTick++;
    const tick = this.state.currentTick;

    // Update all subsystems
    for (const subsystem of this.subsystems.values()) {
      try {
        subsystem.update(tick, TIME_CONSTANTS.MS_PER_TICK_NORMAL);
      } catch (error) {
        this.log(`Error in subsystem ${subsystem.name}: ${String(error)}`);
        this.emit('error', error as Error);
      }
    }

    // Record tick update
    this.applyUpdate({
      type: UpdateType.TickAdvanced,
      path: ['currentTick'],
      newValue: tick,
    });

    // Emit tick event
    this.emit('tick', tick);
  }

  /**
   * Get speed multiplier for game speed setting
   */
  private getSpeedMultiplier(speed: GameSpeed): number {
    switch (speed) {
      case GameSpeed.Paused:
        return 0;
      case GameSpeed.Slow:
        return 0.5;
      case GameSpeed.Normal:
        return 1;
      case GameSpeed.Fast:
        return 2;
      case GameSpeed.VeryFast:
        return 4;
      default:
        return 1;
    }
  }

  /**
   * Schedule the next animation frame
   */
  private scheduleNextFrame(): void {
    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.config.enableDebugLogging) {
      console.log(`[GameEngine] ${message}`);
    }
  }

  /**
   * Cleanup and destroy the engine
   */
  destroy(): void {
    this.stop();
    
    for (const subsystem of this.subsystems.values()) {
      subsystem.cleanup();
    }
    
    this.subsystems.clear();
    this.state = null;
    this.removeAllListeners();
    this.log('Game engine destroyed');
  }

  /**
   * Generate a unique ID
   */
  static generateId(): string {
    return uuidv4();
  }
}
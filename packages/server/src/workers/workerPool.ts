/**
 * Worker Pool - Node.js Worker Threads 池
 *
 * 管理多个 Worker 线程，用于并行执行计算密集型任务
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 获取 Worker 脚本的正确路径
 * 开发模式下服务器可能直接运行 TypeScript（通过 tsx）
 * 但 Worker 线程必须加载编译后的 JS 文件
 */
function resolveWorkerPath(workerName: string): string {
  // 尝试几种可能的路径
  const possiblePaths = [
    // 1. 编译后的 dist 目录（从 dist/workers 运行时）
    join(__dirname, `${workerName}.js`),
    // 2. 从 src 目录运行时，需要查找 dist
    resolve(__dirname, '../../dist/workers', `${workerName}.js`),
    // 3. 从项目根目录的 dist
    resolve(process.cwd(), 'packages/server/dist/workers', `${workerName}.js`),
  ];
  
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  
  // 默认使用第三个路径（最可靠）
  return resolve(process.cwd(), 'packages/server/dist/workers', `${workerName}.js`);
}

interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  currentTask: string | null;
}

/**
 * Worker 池配置
 */
interface WorkerPoolConfig {
  /** Worker 脚本路径 */
  workerPath: string;
  /** 最小 Worker 数量 */
  minWorkers?: number;
  /** 最大 Worker 数量 */
  maxWorkers?: number;
  /** 任务超时时间 (ms) */
  taskTimeout?: number;
  /** Worker 空闲超时时间 (ms) */
  idleTimeout?: number;
}

/**
 * 通用 Worker 池
 */
export class WorkerPool extends EventEmitter {
  private workers: Map<number, WorkerInfo> = new Map();
  private taskQueue: WorkerTask[] = [];
  private taskCounter = 0;
  private workerIdCounter = 0;
  
  private readonly workerPath: string;
  private readonly minWorkers: number;
  private readonly maxWorkers: number;
  private readonly taskTimeout: number;
  // Reserved for future use: idle timeout for worker cleanup
  // private readonly idleTimeout: number;
  
  private isShuttingDown = false;
  
  constructor(config: WorkerPoolConfig) {
    super();
    this.workerPath = config.workerPath;
    this.minWorkers = config.minWorkers ?? 1;
    this.maxWorkers = config.maxWorkers ?? 4;
    this.taskTimeout = config.taskTimeout ?? 30000;
    // Reserved for future use
    // this.idleTimeout = config.idleTimeout ?? 60000;
  }
  
  /**
   * 初始化 Worker 池
   */
  async initialize(): Promise<void> {
    console.log(`[WorkerPool] Initializing with ${this.minWorkers}-${this.maxWorkers} workers`);
    
    // 创建最小数量的 Workers
    for (let i = 0; i < this.minWorkers; i++) {
      await this.createWorker();
    }
    
    console.log(`[WorkerPool] Initialized with ${this.workers.size} workers`);
  }
  
  /**
   * 创建新的 Worker
   */
  private async createWorker(): Promise<WorkerInfo> {
    return new Promise((resolve, reject) => {
      const workerId = this.workerIdCounter++;
      
      try {
        const worker = new Worker(this.workerPath, {
          workerData: { workerId },
        });
        
        const workerInfo: WorkerInfo = {
          worker,
          busy: false,
          currentTask: null,
        };
        
        worker.on('message', (message) => {
          this.handleWorkerMessage(workerId, message);
        });
        
        worker.on('error', (error) => {
          console.error(`[WorkerPool] Worker ${workerId} error:`, error);
          this.handleWorkerError(workerId, error);
        });
        
        worker.on('exit', (code) => {
          console.log(`[WorkerPool] Worker ${workerId} exited with code ${code}`);
          this.workers.delete(workerId);
          
          // 如果不是关闭状态，替换死掉的 Worker
          if (!this.isShuttingDown && this.workers.size < this.minWorkers) {
            this.createWorker().catch(console.error);
          }
        });
        
        worker.on('online', () => {
          console.log(`[WorkerPool] Worker ${workerId} online`);
          this.workers.set(workerId, workerInfo);
          resolve(workerInfo);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(workerId: number, message: { taskId: string; result?: unknown; error?: string }): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    const { taskId, result, error } = message;
    
    // 查找对应的任务
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.taskQueue[taskIndex]!;
      clearTimeout(task.timeout);
      this.taskQueue.splice(taskIndex, 1);
      
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(result);
      }
    }
    
    // 标记 Worker 为空闲
    workerInfo.busy = false;
    workerInfo.currentTask = null;
    
    // 处理下一个任务
    this.processQueue();
  }
  
  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(workerId: number, error: Error): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;
    
    // 拒绝当前任务
    if (workerInfo.currentTask) {
      const taskIndex = this.taskQueue.findIndex(t => t.id === workerInfo.currentTask);
      if (taskIndex !== -1) {
        const task = this.taskQueue[taskIndex]!;
        clearTimeout(task.timeout);
        this.taskQueue.splice(taskIndex, 1);
        task.reject(error);
      }
    }
    
    // 移除错误的 Worker
    this.workers.delete(workerId);
    
    // 创建替代 Worker
    if (!this.isShuttingDown && this.workers.size < this.minWorkers) {
      this.createWorker().catch(console.error);
    }
  }
  
  /**
   * 执行任务
   */
  async execute<T, R>(type: string, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${this.taskCounter++}`;
      
      const timeout = setTimeout(() => {
        const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          this.taskQueue.splice(taskIndex, 1);
        }
        reject(new Error(`Task ${taskId} timeout`));
      }, this.taskTimeout);
      
      const task: WorkerTask<T, R> = {
        id: taskId,
        type,
        data,
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      };
      
      this.taskQueue.push(task as WorkerTask);
      this.processQueue();
    });
  }
  
  /**
   * 处理任务队列
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;
    
    // 找到空闲的 Worker
    let idleWorker: [number, WorkerInfo] | undefined;
    for (const entry of this.workers) {
      if (!entry[1].busy) {
        idleWorker = entry;
        break;
      }
    }
    
    // 如果没有空闲 Worker 且可以创建更多
    if (!idleWorker && this.workers.size < this.maxWorkers) {
      this.createWorker()
        .then(() => this.processQueue())
        .catch(console.error);
      return;
    }
    
    if (!idleWorker) return;
    
    // 取出下一个任务
    const task = this.taskQueue[0];
    if (!task) return;
    
    const [, workerInfo] = idleWorker;
    workerInfo.busy = true;
    workerInfo.currentTask = task.id;
    
    // 发送任务到 Worker
    workerInfo.worker.postMessage({
      taskId: task.id,
      type: task.type,
      data: task.data,
    });
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    queueLength: number;
  } {
    let busyCount = 0;
    for (const info of this.workers.values()) {
      if (info.busy) busyCount++;
    }
    
    return {
      totalWorkers: this.workers.size,
      busyWorkers: busyCount,
      queueLength: this.taskQueue.length,
    };
  }
  
  /**
   * 关闭 Worker 池
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    console.log('[WorkerPool] Shutting down...');
    
    // 取消所有待处理任务
    for (const task of this.taskQueue) {
      clearTimeout(task.timeout);
      task.reject(new Error('Worker pool shutting down'));
    }
    this.taskQueue = [];
    
    // 终止所有 Workers
    const terminatePromises: Promise<number>[] = [];
    for (const workerInfo of this.workers.values()) {
      terminatePromises.push(workerInfo.worker.terminate());
    }
    
    await Promise.all(terminatePromises);
    this.workers.clear();
    
    console.log('[WorkerPool] Shutdown complete');
  }
}

// 创建默认价格计算 Worker 池
let priceWorkerPool: WorkerPool | null = null;

/**
 * 获取价格计算 Worker 池
 */
export function getPriceWorkerPool(): WorkerPool | null {
  return priceWorkerPool;
}

/**
 * 初始化价格计算 Worker 池
 */
export async function initializePriceWorkerPool(): Promise<WorkerPool> {
  if (priceWorkerPool) {
    return priceWorkerPool;
  }
  
  const workerPath = resolveWorkerPath('priceWorker');
  console.log(`[WorkerPool] Resolved worker path: ${workerPath}`);
  
  if (!existsSync(workerPath)) {
    console.error(`[WorkerPool] Worker file not found: ${workerPath}`);
    console.error('[WorkerPool] Please run "pnpm build" in packages/server to compile worker files');
    throw new Error(`Worker file not found: ${workerPath}`);
  }
  
  priceWorkerPool = new WorkerPool({
    workerPath,
    minWorkers: 1,
    maxWorkers: 2,
    taskTimeout: 5000,
  });
  
  try {
    await priceWorkerPool.initialize();
  } catch (error) {
    console.warn('[WorkerPool] Failed to initialize price worker pool, will use main thread:', error);
    priceWorkerPool = null;
  }
  
  return priceWorkerPool!;
}

/**
 * 关闭所有 Worker 池
 */
export async function shutdownWorkerPools(): Promise<void> {
  if (priceWorkerPool) {
    await priceWorkerPool.shutdown();
    priceWorkerPool = null;
  }
}
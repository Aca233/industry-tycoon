/**
 * Common types used across the game
 */

/** Unique identifier type */
export type EntityId = string;

/** Timestamp in milliseconds */
export type Timestamp = number;

/** Game tick number */
export type GameTick = number;

/** Currency amount (in cents to avoid floating point issues) */
export type Money = number;

/** Percentage (0-100) */
export type Percentage = number;

/** Coordinate on the city map */
export interface Position {
  x: number;
  y: number;
}

/** Geographic zone in the city */
export interface Zone {
  id: EntityId;
  name: string;
  center: Position;
  radius: number;
  type: ZoneType;
}

export enum ZoneType {
  Industrial = 'industrial',
  Commercial = 'commercial',
  Residential = 'residential',
  Port = 'port',
  Tech = 'tech',
}

/** Base entity interface */
export interface BaseEntity {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Result type for operations that can fail */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
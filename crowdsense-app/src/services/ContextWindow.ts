/**
 * ContextWindow.ts
 * 
 * High-performance, memory-bounded sliding window context manager.
 * Designed for on-device machine learning pipelines (voice capture, multi-step flows,
 * batch reporting) to maintain working session memory without unbounded RAM growth.
 * 
 * Key Characteristics:
 * 1. Bounded Rolling Buffer: Caps turns (default 5) and total character count (default 500).
 * 2. Explicit Pinned State: Critical session facts (category, location, user overrides)
 *    are pinned in separate slots and survive rolling buffer eviction.
 * 3. Ephemeral / Session-Scoped: Exists only in working RAM during an active task;
 *    discarded on completion or user exit (zero persistent privacy footprint).
 */

export type ContextRole = 'user' | 'assistant' | 'system' | 'model';

export interface ContextEntry {
  id: string;
  timestamp: number;
  role: ContextRole;
  content: string;
  stage?: 'asr' | 'intent_classification' | 'entity_extraction' | 'correction' | 'user_input';
  metadata?: Record<string, any>;
}

export interface ContextLimits {
  maxTurns: number;
  maxChars: number;
}

export interface SessionContext {
  sessionId: string;
  pinned: Record<string, any>;
  rolling: ContextEntry[];
  totalChars: number;
  turnCount: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = {
  maxTurns: 5,
  maxChars: 500,
};

export class ContextWindow {
  private sessionId: string;
  private limits: ContextLimits;
  private pinnedFacts: Map<string, any>;
  private rollingBuffer: ContextEntry[];
  private currentTotalChars: number;

  constructor(sessionId: string = `session_${Date.now()}`, limits: Partial<ContextLimits> = {}) {
    this.sessionId = sessionId;
    this.limits = { ...DEFAULT_CONTEXT_LIMITS, ...limits };
    this.pinnedFacts = new Map<string, any>();
    this.rollingBuffer = [];
    this.currentTotalChars = 0;
  }

  /**
   * Adds a new entry into the sliding rolling buffer.
   * Automatically evicts the oldest unpinned entries if turn or character caps are exceeded.
   */
  public add(
    content: string,
    role: ContextRole = 'user',
    stage?: ContextEntry['stage'],
    metadata?: Record<string, any>
  ): ContextEntry {
    const entry: ContextEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      role,
      content: content.trim(),
      stage,
      metadata,
    };

    this.rollingBuffer.push(entry);
    this.currentTotalChars += entry.content.length;

    this.enforceLimits();
    return entry;
  }

  /**
   * Enforces rolling buffer bounds (maxTurns and maxChars).
   * Evicts the oldest turns in FIFO order.
   */
  private enforceLimits(): void {
    // 1. Evict based on turn count
    while (this.rollingBuffer.length > this.limits.maxTurns) {
      const evicted = this.rollingBuffer.shift();
      if (evicted) {
        this.currentTotalChars -= evicted.content.length;
      }
    }

    // 2. Evict based on character count cap
    while (this.currentTotalChars > this.limits.maxChars && this.rollingBuffer.length > 1) {
      const evicted = this.rollingBuffer.shift();
      if (evicted) {
        this.currentTotalChars -= evicted.content.length;
      }
    }

    // Prevent negative tally drift
    if (this.currentTotalChars < 0) {
      this.recalculateTotalChars();
    }
  }

  private recalculateTotalChars(): void {
    this.currentTotalChars = this.rollingBuffer.reduce((acc, e) => acc + e.content.length, 0);
  }

  /**
   * Pins a critical session fact (e.g. selectedCategory, gpsCoords, userExplicitIntent)
   * that will NEVER be evicted by rolling buffer caps.
   */
  public pin(key: string, value: any): void {
    this.pinnedFacts.set(key, value);
  }

  /**
   * Unpins a previously pinned fact.
   */
  public unpin(key: string): boolean {
    return this.pinnedFacts.delete(key);
  }

  /**
   * Retrieves a pinned fact by key.
   */
  public getPin<T = any>(key: string): T | undefined {
    return this.pinnedFacts.get(key) as T | undefined;
  }

  /**
   * Returns a copy of all pinned facts.
   */
  public getAllPins(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [k, v] of this.pinnedFacts.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  /**
   * Returns all active rolling entries in chronological order.
   */
  public getRollingEntries(): ContextEntry[] {
    return [...this.rollingBuffer];
  }

  /**
   * Returns the most recent turn in the rolling buffer.
   */
  public getLatestEntry(): ContextEntry | null {
    if (this.rollingBuffer.length === 0) return null;
    return this.rollingBuffer[this.rollingBuffer.length - 1];
  }

  /**
   * Assembles a concise, structured snapshot of the working memory for downstream ML models.
   */
  public getContext(): SessionContext {
    return {
      sessionId: this.sessionId,
      pinned: this.getAllPins(),
      rolling: this.getRollingEntries(),
      totalChars: this.currentTotalChars,
      turnCount: this.rollingBuffer.length,
    };
  }

  /**
   * Formats a compact string representation of the sliding context for text-based classifiers.
   */
  public getContextSummary(): string {
    const lines: string[] = [];

    // Pinned facts summary
    const pinnedKeys = Array.from(this.pinnedFacts.keys());
    if (pinnedKeys.length > 0) {
      const pinStr = pinnedKeys.map(k => `${k}=${JSON.stringify(this.pinnedFacts.get(k))}`).join(', ');
      lines.push(`[Pinned Facts: ${pinStr}]`);
    }

    // Rolling transcript
    for (const entry of this.rollingBuffer) {
      lines.push(`${entry.role}: ${entry.content}`);
    }

    return lines.join('\n');
  }

  /**
   * Clears all rolling entries and pinned state.
   * Called when a report is submitted, cancelled, or when user leaves the screen.
   */
  public clear(): void {
    this.pinnedFacts.clear();
    this.rollingBuffer = [];
    this.currentTotalChars = 0;
    this.sessionId = `session_${Date.now()}`;
  }
}

// Export default shared singleton for single-task flows
export const defaultSessionContext = new ContextWindow('global_capture_session');

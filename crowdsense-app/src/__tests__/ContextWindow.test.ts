/**
 * ContextWindow.test.ts
 * 
 * Unit test suite verifying bounded memory, rolling FIFO evictions,
 * character limits, pinned fact persistence, and session clearing.
 */

import { ContextWindow } from '../services/ContextWindow';

describe('ContextWindow Sliding Manager', () => {
  let context: ContextWindow;

  beforeEach(() => {
    context = new ContextWindow('test_session', { maxTurns: 3, maxChars: 100 });
  });

  test('should add entries within bounds', () => {
    context.add('Turn 1: Broken road here', 'user');
    context.add('Turn 2: Detected pothole', 'assistant');

    const rolling = context.getRollingEntries();
    expect(rolling.length).toBe(2);
    expect(rolling[0].content).toBe('Turn 1: Broken road here');
    expect(rolling[1].content).toBe('Turn 2: Detected pothole');
  });

  test('should enforce maxTurns bound and evict oldest turns', () => {
    context.add('Turn 1', 'user');
    context.add('Turn 2', 'user');
    context.add('Turn 3', 'user');
    context.add('Turn 4', 'user'); // Should evict Turn 1

    const rolling = context.getRollingEntries();
    expect(rolling.length).toBe(3);
    expect(rolling.map(r => r.content)).toEqual(['Turn 2', 'Turn 3', 'Turn 4']);
  });

  test('should enforce maxChars bound across rolling turns', () => {
    // maxChars is 100
    context.add('Short 1', 'user'); // ~7 chars
    context.add('This is a rather long sentence intended to consume a significant amount of the character quota in test.', 'user'); // ~104 chars

    const rolling = context.getRollingEntries();
    // Oldest short entry must be evicted because long entry exceeds cap
    expect(rolling.length).toBe(1);
    expect(context.getContext().totalChars).toBeLessThanOrEqual(110);
  });

  test('should retain pinned facts indefinitely across evictions', () => {
    context.pin('selectedCategory', 'pothole');
    context.pin('latitude', 12.9716);

    // Flood the rolling buffer with 10 entries
    for (let i = 0; i < 10; i++) {
      context.add(`Flooding turn ${i}`, 'user');
    }

    expect(context.getRollingEntries().length).toBe(3); // capped at maxTurns=3
    expect(context.getPin('selectedCategory')).toBe('pothole');
    expect(context.getPin('latitude')).toBe(12.9716);
  });

  test('should clear all rolling entries and pinned state on clear()', () => {
    context.pin('category', 'garbage');
    context.add('There is trash everywhere', 'user');

    context.clear();

    expect(context.getRollingEntries().length).toBe(0);
    expect(context.getPin('category')).toBeUndefined();
    expect(context.getContext().totalChars).toBe(0);
  });
});

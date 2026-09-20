import type { Bar } from '../types';

export interface ValidationReport {
  valid: boolean;
  totalRows: number;
  duplicateTimestamps: number;
  nullRowsDropped: number;
  invalidOhlcRows: number;
  zeroVolumeRows: number;
  negativeVolumeRows: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  errors: string[];
}

/**
 * Validates OHLCV bar integrity following the QA specifications
 * established in W:/algo/GEX (low <= min(open, close), high >= max(open, close), etc.)
 */
export function validateAndCleanBars(rawBars: Partial<Bar>[]): { bars: Bar[]; report: ValidationReport } {
  const errors: string[] = [];
  let nullRowsDropped = 0;
  let invalidOhlcRows = 0;
  let zeroVolumeRows = 0;
  let negativeVolumeRows = 0;

  // 1. Filter out null/undefined or invalid numbers
  const cleaned: Bar[] = [];
  for (const b of rawBars) {
    if (
      b.time == null ||
      b.open == null ||
      b.high == null ||
      b.low == null ||
      b.close == null ||
      isNaN(b.time) ||
      isNaN(b.open) ||
      isNaN(b.high) ||
      isNaN(b.low) ||
      isNaN(b.close)
    ) {
      nullRowsDropped++;
      continue;
    }

    const volume = b.volume ?? 0;
    if (volume < 0) {
      negativeVolumeRows++;
      continue;
    }
    if (volume === 0) {
      zeroVolumeRows++;
    }

    // 2. Validate price geometry: low <= min(open, close) and high >= max(open, close) and low <= high
    const minOC = Math.min(b.open, b.close);
    const maxOC = Math.max(b.open, b.close);
    if (b.low > minOC || b.high < maxOC || b.low > b.high) {
      invalidOhlcRows++;
      continue;
    }

    cleaned.push({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume,
      vwap: b.vwap,
      transactions: b.transactions,
    });
  }

  // 3. Sort ascending by time
  cleaned.sort((a, b) => a.time - b.time);

  // 4. Deduplicate timestamps (keep last occurrence)
  const deduplicated: Bar[] = [];
  let duplicateTimestamps = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if (i < cleaned.length - 1 && cleaned[i].time === cleaned[i + 1].time) {
      duplicateTimestamps++;
      continue;
    }
    deduplicated.push(cleaned[i]);
  }

  const valid = deduplicated.length > 0 && invalidOhlcRows === 0 && duplicateTimestamps === 0;
  if (deduplicated.length === 0) {
    errors.push('No valid bars remaining after validation.');
  }

  const timeRange =
    deduplicated.length > 0
      ? {
          start: new Date(deduplicated[0].time),
          end: new Date(deduplicated[deduplicated.length - 1].time),
        }
      : undefined;

  return {
    bars: deduplicated,
    report: {
      valid,
      totalRows: deduplicated.length,
      duplicateTimestamps,
      nullRowsDropped,
      invalidOhlcRows,
      zeroVolumeRows,
      negativeVolumeRows,
      timeRange,
      errors,
    },
  };
}

import type { PineScriptTemplate } from '../types';

const LOCAL_STORAGE_CUSTOM_DIR_KEY = 'nullhyper_custom_pine_dir';

export function getStoredCustomStrategiesDir(): string {
  try {
    return localStorage.getItem(LOCAL_STORAGE_CUSTOM_DIR_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredCustomStrategiesDir(dir: string): void {
  try {
    if (!dir || dir.trim().length === 0) {
      localStorage.removeItem(LOCAL_STORAGE_CUSTOM_DIR_KEY);
    } else {
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_DIR_KEY, dir.trim());
    }
  } catch {
    // ignore
  }
}

export interface FetchStrategiesResult {
  activeFolder: string;
  defaultFolder: string;
  total: number;
  items: PineScriptTemplate[];
}

/**
 * Fetches all .pine files from the active strategies folder (default and/or custom directory).
 */
export async function fetchPineStrategies(customDir?: string): Promise<FetchStrategiesResult> {
  const dirToUse = customDir !== undefined ? customDir : getStoredCustomStrategiesDir();
  const url = dirToUse ? `/api/strategies?dir=${encodeURIComponent(dirToUse)}` : '/api/strategies';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch strategies: ${res.statusText}`);
  }

  const data: FetchStrategiesResult = await res.json();
  return data;
}

/**
 * Saves a Pine Script file into the strategies directory.
 */
export async function savePineStrategy(
  filename: string,
  code: string,
  dir?: string
): Promise<{ ok: boolean; filename: string; path: string }> {
  const dirToUse = dir !== undefined ? dir : getStoredCustomStrategiesDir();

  const res = await fetch('/api/strategies/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      code,
      dir: dirToUse,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Failed to save file: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Subscribes to live HMR file change events from Vite WebSocket.
 */
export function subscribeToStrategiesChanges(onChange: () => void): () => void {
  if (import.meta.hot) {
    const handler = (data: any) => {
      console.log('[PineFileSystem] Live strategies change event received:', data);
      onChange();
    };

    import.meta.hot.on('pine:strategies-changed', handler);

    return () => {
      import.meta.hot?.off('pine:strategies-changed', handler);
    };
  }

  return () => {};
}

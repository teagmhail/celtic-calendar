const cache = new Map<string, Promise<string>>();

export async function fetchTextCached(url: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const existing = cache.get(url);
  if (existing) return existing;

  const p = fetch(url, { signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .catch(err => {
      // Remove failed promise so a later retry can happen
      cache.delete(url);
      throw err;
    });

  cache.set(url, p);
  return p;
}


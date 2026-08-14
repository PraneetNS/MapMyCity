const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.146:8000';

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Create default headers
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

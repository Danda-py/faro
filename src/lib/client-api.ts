export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Corpo JSON della risposta, ad esempio { reauthorize: true }. */
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const raw = await res.text();
  const data = raw ? safelyParse(raw) : {};

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error || `Richiesta fallita (${res.status})`;
    throw new ApiError(res.status, message, data as Record<string, unknown>);
  }

  return data as T;
}

function safelyParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw.slice(0, 200) };
  }
}

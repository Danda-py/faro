const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portale",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText || `Errore GitHub (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* corpo non JSON */
    }
    throw new GithubError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
};

export type GithubEmail = { email: string; primary: boolean; verified: boolean };

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
  owner: { login: string; avatar_url: string };
};

export type GithubTreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
};

export type GithubContent = {
  type: string;
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  download_url: string | null;
};

export type GithubBranch = { name: string };

export async function getUser(token: string) {
  return gh<GithubUser>(token, "/user");
}

export async function getUserEmails(token: string) {
  try {
    return await gh<GithubEmail[]>(token, "/user/emails");
  } catch {
    return [];
  }
}

export async function listRepos(token: string, page = 1): Promise<GithubRepo[]> {
  return gh<GithubRepo[]>(
    token,
    `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
  );
}

export async function getRepo(token: string, owner: string, repo: string) {
  return gh<GithubRepo>(token, `/repos/${owner}/${repo}`);
}

export async function listBranches(token: string, owner: string, repo: string) {
  return gh<GithubBranch[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
}

export async function getTree(token: string, owner: string, repo: string, ref: string) {
  return gh<{ tree: GithubTreeEntry[]; truncated: boolean }>(
    token,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
}

export async function getContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
) {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return gh<GithubContent>(
    token,
    `/repos/${owner}/${repo}/contents/${encodePath(path)}${query}`,
  );
}

export async function putContent(
  token: string,
  owner: string,
  repo: string,
  input: {
    path: string;
    content: string;
    message: string;
    branch?: string;
    sha?: string;
  },
) {
  return gh<{ content: { path: string; sha: string }; commit: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/contents/${encodePath(input.path)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: input.branch,
        sha: input.sha,
      }),
    },
  );
}

export async function deleteContent(
  token: string,
  owner: string,
  repo: string,
  input: { path: string; sha: string; message: string; branch?: string },
) {
  return gh<{ commit: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/contents/${encodePath(input.path)}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        message: input.message,
        sha: input.sha,
        branch: input.branch,
      }),
    },
  );
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "psd",
  "pdf", "zip", "gz", "tar", "rar", "7z", "exe", "dll", "so", "dylib",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi", "woff", "woff2",
  "ttf", "otf", "eot", "class", "jar", "wasm",
]);

export function isProbablyBinary(path: string, buffer: Buffer): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (BINARY_EXTENSIONS.has(ext)) return true;
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

/** Decodifica il contenuto base64 dei file testuali restituiti dall'API contents. */
export function decodeContent(content: GithubContent) {
  if (content.encoding !== "base64" || !content.content) return "";
  const buffer = Buffer.from(content.content, "base64");
  return buffer.toString("utf8");
}

export function rawBuffer(content: GithubContent): Buffer {
  if (content.encoding !== "base64" || !content.content) return Buffer.alloc(0);
  return Buffer.from(content.content, "base64");
}

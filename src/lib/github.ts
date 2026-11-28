const API = "https://api.github.com";
const MAX_ATTEMPTS = 3;

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

export type GithubTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

/**
 * Rinnova un access token scaduto con il refresh token di un'OAuth App che usa
 * token a scadenza (8 ore). GitHub restituisce una nuova coppia di token: il
 * refresh token usato smette di funzionare, quindi va salvato subito.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<GithubTokenResponse & { access_token: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GithubError(500, "GITHUB_CLIENT_ID o GITHUB_CLIENT_SECRET non configurati.");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as GithubTokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new GithubError(
      401,
      "GitHub non ha rinnovato il token: ricollega l'account.",
      data.error_description || data.error,
    );
  }
  return { ...data, access_token: data.access_token };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterSeconds(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (res.headers.get("x-ratelimit-remaining") === "0" && Number.isFinite(reset)) {
    return Math.max(0, Math.ceil(reset - Date.now() / 1000));
  }
  return undefined;
}

/**
 * Traduce una risposta di errore GitHub in un messaggio utile all'utente:
 * distingue token non valido, permessi mancanti, limiti di richieste e
 * disservizi, così l'interfaccia sa se conviene attendere o ricollegare.
 */
async function githubError(res: Response): Promise<GithubError> {
  let raw = res.statusText || `Errore GitHub (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) raw = body.message;
  } catch {
    /* corpo non JSON */
  }

  if (res.status === 429 || /rate limit|abuse|secondary/i.test(raw)) {
    const wait = retryAfterSeconds(res);
    const when =
      wait === undefined
        ? "tra qualche secondo"
        : wait > 90
          ? `tra circa ${Math.ceil(wait / 60)} minuti`
          : `tra ${Math.max(1, Math.round(wait))} secondi`;
    return new GithubError(
      429,
      `GitHub ha temporaneamente bloccato le richieste: riprova ${when}.`,
      raw,
      wait,
    );
  }
  if (res.status === 401) {
    return new GithubError(
      401,
      "GitHub ha rifiutato il token di questo account: ricollegalo per continuare.",
      raw,
    );
  }
  if (res.status === 403) {
    return new GithubError(
      403,
      "GitHub ha negato l'accesso: manca il permesso repo oppure l'organizzazione richiede l'SSO. Ricollega l'account.",
      raw,
    );
  }
  if (res.status === 404) {
    return new GithubError(
      404,
      "Risorsa non trovata su GitHub: potrebbe essere stata rinominata, eliminata o non essere visibile a questo account.",
      raw,
    );
  }
  if (res.status >= 500) {
    return new GithubError(502, "GitHub non risponde in questo momento: riprova tra poco.", raw);
  }
  return new GithubError(res.status, raw, raw);
}

function isRetryable(error: GithubError) {
  if (error.status === 429) return (error.retryAfterSeconds ?? 0) <= 5;
  return error.status === 502;
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
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
    } catch {
      // Errori di rete: un paio di tentativi coprono i cali momentanei.
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw new GithubError(
        502,
        "Impossibile raggiungere GitHub: controlla la connessione e riprova.",
      );
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const error = await githubError(res);
    if (attempt < MAX_ATTEMPTS - 1 && isRetryable(error)) {
      const delay = Math.min(
        5000,
        Math.round((error.retryAfterSeconds ?? 0.4 * 2 ** attempt) * 1000),
      );
      await sleep(delay);
      continue;
    }
    throw error;
  }
}

export type GithubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
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
  mode?: string;
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

export type GithubRef = { ref: string; object: { sha: string } };

export type GithubCommit = { sha: string; tree: { sha: string } };

export async function getUser(token: string) {
  return gh<GithubUser>(token, "/user");
}

export async function updateGithubProfile(
  token: string,
  profile: { name?: string | null; bio?: string | null; company?: string | null; location?: string | null; blog?: string | null; twitter_username?: string | null },
) {
  return gh<GithubUser>(token, "/user", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
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

export async function updateRepo(
  token: string,
  owner: string,
  repo: string,
  patch: { name?: string; description?: string | null; private?: boolean; archived?: boolean },
) {
  return gh<GithubRepo>(token, `/repos/${owner}/${repo}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteRepo(token: string, owner: string, repo: string) {
  return gh<void>(token, `/repos/${owner}/${repo}`, { method: "DELETE" });
}

export async function createRepo(
  token: string,
  input: { name: string; description?: string | null; private?: boolean },
) {
  return gh<GithubRepo>(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description?.trim() || null,
      private: input.private ?? false,
      auto_init: true,
    }),
  });
}

export async function createBlob(
  token: string,
  owner: string,
  repo: string,
  contentBase64: string,
) {
  return gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: contentBase64, encoding: "base64" }),
  });
}

/**
 * Crea un unico commit con i file indicati (già caricati come blob),
 * partendo dall'HEAD corrente del branch.
 */
export async function importFiles(
  token: string,
  owner: string,
  repo: string,
  input: { branch: string; message: string; files: { path: string; sha: string }[] },
) {
  if (input.files.length === 0) return { commit: null, files: 0 };
  if (input.files.length > 3000) throw new GithubError(400, "Troppi file in un solo commit (massimo 3000).");

  const treeItems = input.files.map((file) => ({
    path: normalizeRepoPath(file.path),
    mode: "100644",
    type: "blob" as const,
    sha: file.sha,
  }));
  const unique = new Set(treeItems.map((item) => item.path));
  if (unique.size !== treeItems.length) throw new GithubError(400, "Ci sono percorsi duplicati tra i file.");

  const branchPath = encodeRefPath(input.branch);
  let ref: GithubRef;
  try {
    ref = await gh<GithubRef>(token, `/repos/${owner}/${repo}/git/ref/heads/${branchPath}`);
  } catch (error) {
    if (error instanceof GithubError && error.status === 404) {
      throw new GithubError(
        409,
        `Il branch "${input.branch}" non esiste ancora o il repository è vuoto: crea un commit iniziale (ad esempio un README) e riprova.`,
        error.detail,
      );
    }
    throw error;
  }
  const parent = await gh<GithubCommit>(token, `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
  const tree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeItems }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      tree: tree.sha,
      parents: [ref.object.sha],
    }),
  });
  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branchPath}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { commit: commit.sha, files: treeItems.length };
}

/**
 * Scarica l'archivio ZIP dell'intero repository. GitHub risponde con un redirect
 * verso codeload; il fetch lo segue e l'URL temporaneo contiene già l'autorizzazione.
 */
export async function downloadArchive(
  token: string,
  owner: string,
  repo: string,
  ref?: string,
) {
  const url = `${API}/repos/${owner}/${repo}/zipball${ref ? `/${encodeURIComponent(ref)}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portale",
    },
  });
  if (!res.ok) throw await githubError(res);
  return res;
}

/** Percorso file relativo al repository, validato contro traversal e cartelle .git. */
export function normalizeRepoPath(input: string) {
  const path = input.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  const parts = path.split("/");
  if (
    !path ||
    path.length > 1024 ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.toLowerCase() === ".git",
    )
  ) {
    throw new GithubError(400, `Percorso file non valido: ${input.slice(0, 120)}`);
  }
  return path;
}

function encodeRefPath(ref: string) {
  return ref.split("/").map(encodeURIComponent).join("/");
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

export async function moveOrDeleteFolder(
  token: string,
  owner: string,
  repo: string,
  input: { branch: string; sourcePath: string; destinationPath?: string },
) {
  const tree = await getTree(token, owner, repo, input.branch);
  if (tree.truncated) throw new Error("Folder is too large for a single operation.");

  const sourcePath = input.sourcePath.split("/").filter(Boolean).join("/");
  if (!sourcePath || sourcePath.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Percorso cartella non valido.");
  }
  const sourcePrefix = `${sourcePath}/`;
  const files = tree.tree.filter((entry) => entry.type === "blob");
  const sourceFiles = files.filter((entry) => entry.path.startsWith(sourcePrefix));
  if (sourceFiles.length === 0) throw new Error("Folder contains no files or no longer exists.");

  const destination = input.destinationPath?.split("/").filter(Boolean).join("/");
  if (destination && (destination === sourcePath || destination.startsWith(sourcePrefix) || destination.split("/").some((part) => part === "." || part === ".."))) {
    throw new Error("Invalid destination path: a folder cannot be moved inside itself.");
  }
  if (destination) {
    const unaffectedFiles = files.filter((entry) => !entry.path.startsWith(sourcePrefix));
    const targetPaths = sourceFiles.map((entry) => `${destination}/${entry.path.slice(sourcePrefix.length)}`);
    const collision = targetPaths.some((target) => unaffectedFiles.some((entry) =>
      entry.path === target || entry.path.startsWith(`${target}/`) || target.startsWith(`${entry.path}/`),
    ));
    if (collision) throw new Error("A destination file or directory already exists.");
  }

  const branchPath = input.branch.split("/").map(encodeURIComponent).join("/");
  const base = await gh<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${branchPath}`);
  const parent = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${base.object.sha}`);
  const treeItems: Array<{ path: string; mode: string; type: "blob"; sha: string | null }> = [];
  for (const file of sourceFiles) {
    if (destination) {
      treeItems.push({
        path: `${destination}/${file.path.slice(sourcePrefix.length)}`,
        mode: file.mode ?? "100644",
        type: "blob",
        sha: file.sha,
      });
    }
    treeItems.push({ path: file.path, mode: file.mode ?? "100644", type: "blob", sha: null });
  }
  const nextTree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeItems }),
  });
  const commit = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: destination ? `Sposta ${sourcePath} in ${destination}` : `Elimina cartella ${sourcePath}`,
      tree: nextTree.sha,
      parents: [base.object.sha],
    }),
  });
  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branchPath}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return { moved: sourceFiles.length, branch: input.branch };
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

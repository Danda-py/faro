import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import {
  createBlob,
  createRepo,
  GithubError,
  importFiles,
  normalizeRepoPath,
} from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BLOB_FILES = 40;
const MAX_BLOB_CHARS = 3_800_000;
const MAX_FILES_PER_COMMIT = 3000;

type RepoBody = {
  action: "repo";
  accountId?: string;
  name?: string;
  description?: string;
  private?: boolean;
};

type BlobsBody = {
  action: "blobs";
  accountId?: string;
  owner?: string;
  repo?: string;
  files?: { path?: string; content?: string }[];
};

type CommitBody = {
  action: "commit";
  accountId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  message?: string;
  files?: { path?: string; sha?: string }[];
};

type Body = RepoBody | BlobsBody | CommitBody;

function segment(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.includes("/") ||
    value.length > 200
  ) {
    throw new GithubError(400, `${label} non valido.`);
  }
  return value.trim();
}

/** I branch possono contenere "/" (es. feature/esercizi), a differenza di owner e repo. */
function branchName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 250) {
    throw new GithubError(400, "Branch non valido.");
  }
  const name = value.trim();
  if (name.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new GithubError(400, "Branch non valido.");
  }
  return name;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as Body;
    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) {
      return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });
    }

    if (body.action === "repo") {
      const name = (body.name ?? "").trim();
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) {
        return NextResponse.json(
          {
            error:
              "Il nome può contenere solo lettere, numeri, punto, trattino e underscore (1-100 caratteri).",
          },
          { status: 400 },
        );
      }
      if ((body.description ?? "").length > 350) {
        return NextResponse.json(
          { error: "La descrizione non può superare 350 caratteri." },
          { status: 400 },
        );
      }
      const repo = await createRepo(account.token, {
        name,
        description: body.description,
        private: Boolean(body.private),
      });
      return NextResponse.json({
        repo: {
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          defaultBranch: repo.default_branch,
          private: repo.private,
        },
      });
    }

    const owner = segment(body.owner, "Proprietario");
    const repo = segment(body.repo, "Repository");

    if (body.action === "blobs") {
      const files = body.files ?? [];
      if (!Array.isArray(files) || files.length === 0 || files.length > MAX_BLOB_FILES) {
        return NextResponse.json(
          { error: `Carica da 1 a ${MAX_BLOB_FILES} file per richiesta.` },
          { status: 400 },
        );
      }
      let totalChars = 0;
      const prepared = files.map((file) => {
        const path = normalizeRepoPath(file.path ?? "");
        if (typeof file.content !== "string") {
          throw new GithubError(400, `Contenuto mancante per ${path}.`);
        }
        if (file.content.length > MAX_BLOB_CHARS) {
          throw new GithubError(400, `Il file ${path} supera il limite di 2,5 MB.`);
        }
        totalChars += file.content.length;
        return { path, content: file.content };
      });
      if (totalChars > MAX_BLOB_CHARS) {
        throw new GithubError(400, "Il gruppo di file supera il limite di dimensione.");
      }

      const blobs = await mapLimit(prepared, 6, async (file) => {
        const blob = await createBlob(account.token, owner, repo, file.content);
        return { path: file.path, sha: blob.sha };
      });
      return NextResponse.json({ blobs });
    }

    if (body.action === "commit") {
      const branch = branchName(body.branch);
      const files = body.files ?? [];
      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: "Nessun file da includere nel commit." }, { status: 400 });
      }
      if (files.length > MAX_FILES_PER_COMMIT) {
        return NextResponse.json(
          { error: `Massimo ${MAX_FILES_PER_COMMIT} file per repository.` },
          { status: 400 },
        );
      }
      const prepared = files.map((file) => {
        const path = normalizeRepoPath(file.path ?? "");
        if (typeof file.sha !== "string" || !/^[0-9a-f]{40,64}$/i.test(file.sha)) {
          throw new GithubError(400, `Blob non valido per ${path}.`);
        }
        return { path, sha: file.sha };
      });
      const result = await importFiles(account.token, owner, repo, {
        branch,
        message: body.message?.trim().slice(0, 500) || "Importa file da Faro",
        files: prepared,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Azione non supportata." }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}

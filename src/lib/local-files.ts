/** Utility condivise per leggere file e cartelle dal computer dell'utente. */

export type PickedFile = { path: string; file: File };

const IGNORED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".turbo",
  ".parcel-cache",
]);

/** Cartelle di dipendenze, build e file di sistema che non vanno su GitHub. */
export function skipPath(path: string) {
  const parts = path.split("/");
  const name = parts[parts.length - 1];
  if (name === ".DS_Store" || name === "Thumbs.db") return true;
  return parts.some((part) => IGNORED_SEGMENTS.has(part));
}

export function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function readDirectory(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readAllEntries(reader: FileSystemDirectoryReader) {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await readDirectory(reader);
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

export async function collectEntry(
  entry: FileSystemEntry,
  prefix: string,
  collected: PickedFile[],
  skipped: { count: number },
) {
  if (skipPath(`${prefix}${entry.name}`)) {
    skipped.count += 1;
    return;
  }
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    collected.push({ path: `${prefix}${entry.name}`, file });
    return;
  }
  if (!entry.isDirectory) return;
  const directory = entry as FileSystemDirectoryEntry;
  const children = await readAllEntries(directory.createReader());
  if (children.length === 0) {
    collected.push({
      path: `${prefix}${entry.name}/.gitkeep`,
      file: new File(["\n"], ".gitkeep"),
    });
    return;
  }
  for (const child of children) {
    await collectEntry(child, `${prefix}${entry.name}/`, collected, skipped);
  }
}

/** Cartella radice comune, da rimuovere per usare la selezione come radice. */
export function commonRootPrefix(files: PickedFile[]) {
  if (files.length === 0) return "";
  if (!files.every((item) => item.path.includes("/"))) return "";
  const tops = new Set(files.map((item) => item.path.split("/")[0]));
  return tops.size === 1 ? [...tops][0] : "";
}

/** Normalizza una cartella di destinazione opzionale (senza slash iniziali/finali). */
export function normalizeDestination(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

export function validateDestination(value: string) {
  const path = normalizeDestination(value);
  if (path.split("/").some((part) => part === "." || part === "..")) {
    throw new Error('La cartella di destinazione non può contenere "." o "..".');
  }
  return path;
}

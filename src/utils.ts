import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(path: string): Promise<T> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents) as T;
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendJsonLine(path: string, value: unknown): Promise<void> {
  const line = `${JSON.stringify(value)}\n`;
  const existing = (await fileExists(path)) ? await readFile(path, "utf8") : "";
  await writeFile(path, `${existing}${line}`, "utf8");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeFivePoint(value: number): number {
  return clamp(value, 1, 5) / 5;
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function hashFileSha256(path: string): Promise<string> {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

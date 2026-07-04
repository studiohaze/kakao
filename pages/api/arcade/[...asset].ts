import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { readFile } from 'fs/promises';

const gamesRoot = path.resolve(process.cwd(), 'games');

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.tpz')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function resolveAsset(parts: string[]): string | null {
  if (parts.length === 1 && parts[0] === 'manifest') return path.join(gamesRoot, 'manifest.json');
  if (parts.length < 2) return null;
  if (!parts.every((part) => /^[a-zA-Z0-9._-]+$/.test(part))) return null;
  const fullPath = path.resolve(gamesRoot, ...parts);
  return fullPath.startsWith(`${gamesRoot}${path.sep}`) ? fullPath : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end();
    return;
  }

  const asset = req.query.asset;
  const parts = Array.isArray(asset) ? asset : [];
  const fullPath = resolveAsset(parts);
  if (!fullPath || (!fullPath.endsWith('.json') && !fullPath.endsWith('.tpz'))) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  try {
    const body = await readFile(fullPath, 'utf8');
    res.setHeader('Content-Type', contentTypeFor(fullPath));
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.status(200).send(body);
  } catch {
    res.status(404).json({ error: 'not found' });
  }
}

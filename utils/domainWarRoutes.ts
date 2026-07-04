export const DOMAIN_WAR_GAME_ID = 'domain-war';

const DOMAIN_WAR_SCENE_COUNTS = [0, 6, 7, 5, 5, 6, 6, 5, 5, 3];

export function getArcadeGamePath(gameId: string, sceneId?: string): string {
  const base = `/play/${gameId}`;
  return sceneId ? `${base}?at=${encodeURIComponent(sceneId)}` : base;
}

export function getDomainWarSceneId(chapterNumber: number, sceneIndex: number): string | null {
  const sceneCount = DOMAIN_WAR_SCENE_COUNTS[chapterNumber];
  if (!sceneCount || sceneIndex < 0 || sceneIndex >= sceneCount) return null;
  return `ch${chapterNumber}_scene${sceneIndex}`;
}

export function isDomainWarSceneId(sceneId: string): boolean {
  const match = /^ch(\d+)_scene(\d+)$/.exec(sceneId);
  if (!match) return false;
  return getDomainWarSceneId(Number(match[1]), Number(match[2])) === sceneId;
}

export function legacySlugToDomainWarSceneId(slug: string[] | undefined): string | null {
  if (!slug || slug.length !== 2) return null;
  const chapterMatch = /^domain-ch(\d+)$/.exec(slug[0]);
  if (!chapterMatch) return null;
  const sceneIndex = Number(slug[1]);
  if (!Number.isInteger(sceneIndex)) return null;
  return getDomainWarSceneId(Number(chapterMatch[1]), sceneIndex);
}

export function getLegacyDomainWarRedirect(slug: string[] | undefined): string | null {
  const sceneId = legacySlugToDomainWarSceneId(slug);
  return sceneId ? getArcadeGamePath(DOMAIN_WAR_GAME_ID, sceneId) : null;
}

export function withLocalePrefix(destination: string, locale?: string, defaultLocale: string = 'ko'): string {
  if (!locale || locale === defaultLocale) return destination;
  return `/${locale}${destination}`;
}

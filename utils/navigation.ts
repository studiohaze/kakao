import { DOMAIN_WAR_GAME_ID, getArcadeGamePath, getDomainWarSceneId } from './domainWarRoutes';

/**
 * Constructs the path to a specific game scene.
 * @param chapterNumber The chapter number.
 * @param sceneIndex The scene index within the chapter.
 * @param isDebug Optional. If true, prefixes the path with /debug. Defaults to false.
 * @returns The path string for the game scene.
 */
export function getGameScenePath(chapterNumber: number, sceneIndex: number, isDebug: boolean = false): string {
  const basePath = isDebug ? '/debug' : '';
  const sceneId = getDomainWarSceneId(chapterNumber, sceneIndex);
  return `${basePath}${getArcadeGamePath(DOMAIN_WAR_GAME_ID, sceneId ?? 'ch1_scene0')}`;
}

/**
 * Returns the path to the home page.
 * @param isDebug Optional. If true, returns /debug/. Defaults to false.
 * @returns The path string for the home page.
 */
export function getHomePath(isDebug: boolean = false): string {
  return isDebug ? '/debug/' : '/';
}

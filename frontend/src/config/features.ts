export interface FeatureEnvironment {
  PROD: boolean;
  VITE_ENABLE_GAME_GROUPS?: string;
}

/**
 * Game groups are safe to keep available while developing, but need an
 * explicit production opt-in. Set VITE_ENABLE_GAME_GROUPS=true and redeploy
 * when the feature is ready to return to production.
 */
export function isGameGroupsEnabled(environment: FeatureEnvironment): boolean {
  return environment.PROD
    ? environment.VITE_ENABLE_GAME_GROUPS === "true"
    : environment.VITE_ENABLE_GAME_GROUPS !== "false";
}

export const GAME_GROUPS_ENABLED = isGameGroupsEnabled(import.meta.env);

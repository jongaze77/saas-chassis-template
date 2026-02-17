export interface FeatureFlags {
  FEATURE_ASSIGNMENTS: boolean;
  FEATURE_PERMISSIONS: boolean;
  FEATURE_BILLING: boolean;
  FEATURE_SELF_SERVICE: boolean;
}

export const featureFlags: FeatureFlags = {
  FEATURE_ASSIGNMENTS: false,
  FEATURE_PERMISSIONS: false,
  FEATURE_BILLING: false,
  FEATURE_SELF_SERVICE: false,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}

// Feature flags pattern: add your domain-specific feature flags here.
// Use environment variables or a feature flag service to toggle features
// per environment (development, staging, production).

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureFlags {
  // Add your feature flags here, e.g.: FEATURE_EXAMPLE: boolean;
}

export const featureFlags: FeatureFlags = {
  // Example: FEATURE_EXAMPLE: false,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}

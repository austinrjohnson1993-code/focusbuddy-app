const PRO_FEATURES = ['sms_checkin', 'unlimited_ai', 'calendar_sync', 'wearables']

const UPGRADE_MESSAGES = {
  sms_checkin:   'SMS check-ins are a Pro feature. Upgrade to get texts from Cinis.',
  unlimited_ai:  "You've reached your daily AI limit. Upgrade to Pro for unlimited coaching.",
  calendar_sync: 'Calendar sync is a Pro feature.',
  wearables:     'Wearable integrations are Pro features.',
}

/**
 * Returns true if the feature is gated (user does not have access).
 * Returns false if the user is Pro (no gate) or the feature is free.
 */
export function isProFeature(feature, profile) {
  if (profile?.subscription_status === 'pro') return false // not gated
  return PRO_FEATURES.includes(feature) // true = gated
}

export function getUpgradeMessage(feature) {
  return UPGRADE_MESSAGES[feature] || 'Upgrade to Pro to unlock this feature.'
}

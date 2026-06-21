/**
 * Flip ATProto data layer — drop-in replacements for Loops REST calls
 * used by the loops-expo UI.
 */
export {
  fetchFollowingFeed,
  fetchForYouFeed,
  fetchLocalFeed,
  fetchSelfAccountVideos,
  fetchUserVideos,
  recordImpression,
} from './feeds'

export { videoLike, videoUnlike, videoBookmark, videoUnbookmark } from './social'

export {
  fetchSelfAccount,
  getConfiguration,
  getPreferences,
  updatePreferences,
  openBrowser,
  loginWithPassword,
  hydrateSession,
  refreshSession,
  getCurrentUser,
  getCurrentServer,
  logout,
  isAuthenticated,
} from './auth'

export type { FlipVideo, FlipFeedPage, FlipUserProfile } from './types'

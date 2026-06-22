/**
 * Flip ATProto data layer — drop-in replacements for Loops REST calls
 * used by the loops-expo UI.
 */
export {
  fetchFollowingFeed,
  fetchForYouFeed,
  fetchLocalFeed,
  fetchSelfAccountVideos,
  fetchSelfAccountPhotos,
  fetchUserVideos,
  fetchUserPhotos,
  fetchAuthorRecentMediaThumbnail,
  fetchAuthorRecentMediaThumbnailList,
  fetchAuthorRecentMediaThumbnails,
  fetchUserVideoCursor,
  fetchPostForViewer,
  fetchAccountLikes,
  fetchAccountFavorites,
  recordImpression,
  invalidateFollowingDidsCache,
  clearFollowingDidsCache,
  warmFollowingDidsCache,
} from './feeds'

export {
  getExploreTags,
  getExploreAccounts,
  getExploreTextPosts,
  getExploreTagsFeed,
  postExploreAccountHideSuggestion,
} from './explore'

export { searchContent } from './search'

export { videoLike, videoUnlike, videoBookmark, videoUnbookmark, videoRepost, videoUnrepost } from './social'

export {
  fetchVideoComments,
  fetchVideoReplies,
  commentPost,
  commentLike,
  commentUnlike,
  commentReplyLike,
  commentReplyUnlike,
  commentDelete,
  commentReplyDelete,
} from './comments'

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

export {
  fetchUnreadNotificationCount,
  fetchUnreadLikeCount,
  fetchUnreadFollowCount,
  fetchInboxUnreadBreakdown,
  fetchNotifications,
  fetchActivityNotifications,
  fetchFollowerNotifications,
  notificationMarkAsRead,
  notificationTypeMarkAllAsRead,
  resolveNotificationTapTarget,
} from './notifications'

export {
  fetchConvos,
  fetchUnreadDmCount,
  fetchConvoMessages,
  sendChatMessage,
  markConvoRead,
  getOrCreateConvo,
  convoTitle,
  convoAvatar,
} from './chat'
export type { FlipConvo, FlipChatMessage, FlipConvoMember } from './chat'

export {
  fetchAccount,
  fetchAccountState,
  followAccount,
  unfollowAccount,
  cancelFollowRequest,
  blockAccount,
  unblockAccount,
} from './profile'

export { fetchReportRules, submitReport } from './moderation'

export { uploadMediaPost } from './upload'
export type { AtprotoUploadOptions, AtprotoUploadResult } from './upload'

export type { FlipVideo, FlipFeedPage, FlipTextPost, FlipTextPostsPage, FlipUserProfile } from './types'

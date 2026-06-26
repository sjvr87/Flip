/**
 * Flip ATProto data layer — drop-in replacements for Loops REST calls
 * used by the loops-expo UI.
 */
export {
    fetchFollowingFeed,
    fetchForYouFeed,
    fetchTrendingFeed,
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
    fetchFollowingDidsSet,
    isAccountFollowed,
    addAccountToFollowingCache,
    appendAccountToFollowingSet,
} from './feeds';

export {
    getExploreTags,
    getExploreAccounts,
    getExploreTextPosts,
    getExploreTagsFeed,
    postExploreAccountHideSuggestion,
} from './explore';

export { searchContent } from './search';

export {
    videoLike,
    videoUnlike,
    videoBookmark,
    videoUnbookmark,
    videoRepost,
    videoUnrepost,
} from './social';

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
} from './comments';

export {
    fetchSelfAccount,
    getConfiguration,
    getPreferences,
    updatePreferences,
    openBrowser,
    loginWithPassword,
    loginWithOAuth,
    hydrateSession,
    refreshSession,
    getCurrentUser,
    getCurrentServer,
    logout,
    isAuthenticated,
} from './auth';

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
} from './notifications';

export {
    fetchConvos,
    fetchUnreadDmCount,
    fetchConvoMessages,
    sendChatMessage,
    markConvoRead,
    getOrCreateConvo,
    convoTitle,
    convoAvatar,
} from './chat';
export type { FlipConvo, FlipChatMessage, FlipConvoMember } from './chat';

export {
    fetchAccount,
    fetchAccountState,
    fetchAccountFollowers,
    fetchAccountFollowing,
    followAccount,
    unfollowAccount,
    cancelFollowRequest,
    blockAccount,
    unblockAccount,
} from './profile';

export {
    fetchProfilePrefs,
    saveProfilePrefs,
    canViewFollowLists,
    PROFILE_PREFS_COLLECTION,
} from './profilePrefs';
export type { FlipProfilePrefs } from './profilePrefs';

export { fetchProfileTheme, saveProfileTheme, PROFILE_THEME_COLLECTION } from './profileTheme';
export type { FlipProfileTheme } from './profileTheme';

export {
    fetchProfileDisplayLinks,
    getProfileLinksForSelf,
    getProfileLinksForActor,
    addProfileLink,
    deleteProfileLink,
    fetchProfileLinkAnalytics,
    recordProfileLinkClick,
    PROFILE_LINKS_COLLECTION,
} from './profileLinks';
export type {
    FlipProfileLinkRow,
    ProfileDisplayLink,
    ProfileLinksPayload,
    StoredProfileLink,
} from './profileLinks';

export { fetchReportRules, submitReport } from './moderation';

export { uploadMediaPost } from './upload';
export type { AtprotoUploadOptions, AtprotoUploadResult } from './upload';

export type {
    FlipVideo,
    FlipFeedPage,
    FlipTextPost,
    FlipTextPostsPage,
    FlipUserProfile,
} from './types';

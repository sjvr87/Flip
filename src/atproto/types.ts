/** Flip video card shape — matches what loops-expo feed UI expects. */
export type FlipAccount = {
  id: string
  name: string
  avatar: string
  username: string
  is_owner?: boolean
  bio?: string
  post_count?: number
  follower_count?: number
  following_count?: number
  url?: string
}

export type FlipMedia = {
  width: number
  height: number
  thumbnail: string
  src_url: string
  duration?: number
}

export type FlipPermissions = {
  can_comment?: boolean
  can_download?: boolean
  can_duet?: boolean
}

export type FlipVideo = {
  id: string
  cid: string
  account: FlipAccount
  caption: string
  url: string
  is_owner: boolean
  is_sensitive: boolean
  is_photo?: boolean
  media_type?: 'video' | 'photo'
  media: FlipMedia
  likes: number
  shares: number
  comments: number
  bookmarks: number
  has_liked: boolean
  has_bookmarked: boolean
  has_reposted?: boolean
  created_at: string
  tags?: string[]
  mentions?: Array<{
    username: string
    profile_id?: string
    start_index: number
    end_index: number
  }>
  permissions?: FlipPermissions
}

export type FlipFeedPage = {
  data: FlipVideo[]
  meta: {
    path: string
    per_page: number
    next_cursor: string | null
    prev_cursor?: string | null
    /** Set when the feed could not load geo/local content or fell back. */
    error?: string | null
  }
}

export type FlipUserProfile = {
  id: string
  username: string
  name: string
  avatar: string
  bio: string
  post_count: number
  follower_count: number
  following_count: number
  url: string
  is_owner: boolean
  has_playlists: boolean
  acct?: string
  display_name?: string
}

export type FlipAppConfig = {
  fyf: boolean
  registration: boolean
}

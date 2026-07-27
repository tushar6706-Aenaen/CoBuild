// Data functions and Zod schemas land here in Phase 1+.
// Every exported data function takes a Supabase client as its first
// argument — never constructs its own — so web (SSR client) and mobile
// (SecureStore client) can share this package unchanged.

export {
  USERNAME_REGEX,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  RESERVED_USERNAMES,
  isReservedUsername,
  usernameSchema,
  validateUsername,
} from "./username";
export type { UsernameCheckResult } from "./username";

export { usernameIsTaken, getProfileByUsername, isFollowing } from "./profiles";
export type { ProfileSummary } from "./profiles";

export { publicStorageUrl, transformedStorageUrl, IMAGE_SIZES } from "./storage";
export type { TransformFit } from "./storage";

export {
  getProfileProjects,
  getProfileContributions,
  getProfileBookmarks,
  PROFILE_TAB_LIMIT,
} from "./profile-projects";
export type { ProjectTile } from "./profile-projects";

export { slugify, uniqueSlug } from "./slug";

export {
  TITLE_MAX,
  TAGLINE_MAX,
  DESCRIPTION_MAX,
  MAX_IMAGES,
  ALT_MAX,
  CAPTION_MAX,
  ROLE_LABEL_MAX,
  PROJECT_STATUSES,
  PROJECT_VISIBILITIES,
  projectImageSchema,
  collaboratorSchema,
  projectDraftSchema,
  validateForPublish,
} from "./project-schema";
export type { ProjectStatus, ProjectVisibility, ProjectDraft } from "./project-schema";

export {
  getAuthorSlugs,
  searchTags,
  findOrCreateTag,
  searchProfiles,
  saveProject,
  deleteProject,
} from "./projects";
export type { TagOption, CollaboratorOption } from "./projects";

export {
  getProjectDetail,
  getProjectComments,
  getViewerProjectState,
  MAX_COMMENT_DEPTH,
} from "./project-detail";
export type { ProjectDetail, CommentNode } from "./project-detail";

export {
  getFeedPage,
  getViewerVoteState,
  FEED_PAGE_SIZE,
  FEED_MAX_PAGE_SIZE,
} from "./feed";
export type { FeedTab, TopWindow, FeedCursor, FeedItem } from "./feed";

export {
  getLeaderboardProjects,
  getLeaderboardBuilders,
  LEADERBOARD_WINDOWS,
  LEADERBOARD_LIMIT,
} from "./leaderboard";
export type {
  LeaderboardWindow,
  LeaderboardProjectRow,
  LeaderboardBuilderRow,
  Leaderboard,
} from "./leaderboard";

export {
  searchProjects,
  searchPeople,
  searchTagDirectory,
  parseStatusFilters,
  SEARCH_PROJECT_LIMIT,
  SEARCH_PEOPLE_LIMIT,
  SEARCH_TAG_LIMIT,
} from "./search";
export type { SearchProjectHit, PersonHit, TagHit, SearchResult } from "./search";

export { getTagBySlug, getRelatedTags } from "./tags";
export type { TagSummary, RelatedTag } from "./tags";

export {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationHref,
  NOTIFICATION_TYPES,
  NOTIFICATION_PAGE_LIMIT,
  UNREAD_BADGE_CAP,
} from "./notifications";
export type { NotificationItem, NotificationType } from "./notifications";

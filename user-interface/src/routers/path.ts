// ----------------------------------------------------------------------

const ROOTS = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
};

export const paths = {
  home: ROOTS.HOME,

  login: `${ROOTS.HOME}login`,
  register: `${ROOTS.HOME}/register`,

  postDetail: `${ROOTS.HOME}/posts/:id`,

  notifications: `${ROOTS.HOME}notifications`,

  explore: `${ROOTS.HOME}/explore`,

  messages: `${ROOTS.HOME}/messages`,

  bookmarks: `${ROOTS.HOME}/bookmarks`,

  profile: `${ROOTS.HOME}/users/:id`,
  profileDetail: `${ROOTS.HOME}/users/:id/edit`,

  settings: `${ROOTS.HOME}settings`,

  following: `${ROOTS.HOME}/following`,

  exploreDetail: `${ROOTS.HOME}/explore/:id`,

  // Admin routes
  admin: ROOTS.ADMIN,
  adminUsers: `${ROOTS.ADMIN}/users`,
  adminPosts: `${ROOTS.ADMIN}/posts`,
  adminReports: `${ROOTS.ADMIN}/reports`,
};

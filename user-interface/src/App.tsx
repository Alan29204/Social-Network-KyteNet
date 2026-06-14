import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { MainLayout } from '@/layouts/main-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { AuthGuard, GuestGuard } from '@/layouts/auth-guard';
import HomePage from '@/features/home/pages/home-page';
import LoginPage from '@/features/auth/pages/login-page';
import RegisterPage from '@/features/auth/pages/register-page';
import ProfilePage from '@/features/profile/pages/profile-page';
import EditProfilePage from '@/features/profile/pages/edit-profile-page';
import ExplorePage from '@/features/explore/pages/explore-page';
import SuggestedPeoplePage from '@/features/explore/pages/suggested-people-page';
import MessagesPage from '@/features/chats/pages/messages-page';
import PostPage from '@/features/posts/pages/post-page';
import SearchPage from '@/features/search/pages/search-page';
import ReelsPage from '@/features/reels/pages/reels-page';
import SavedPage from '@/features/saved/pages/saved-page';
import { Toaster } from '@/components/ui/toaster';
import { ScrollToTop } from '@/components/scroll-to-top';
import { AdminGuard } from '@/layouts/admin-guard';
import { AdminLayout } from '@/layouts/admin-layout';
import AdminDashboardPage from '@/features/admin/pages/admin-dashboard-page';
import AdminUsersPage from '@/features/admin/pages/admin-users-page';
import AdminPostsPage from '@/features/admin/pages/admin-posts-page';
import AdminReportsPage from '@/features/admin/pages/admin-reports-page';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<GuestGuard />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<AuthGuard />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
              <Route path="/profile/:id/:tab" element={<ProfilePage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/post/:id" element={<PostPage />} />
              {/* Add other routes like /explore here later */}
              <Route path="search" element={<SearchPage />} />
              <Route path="reels" element={<ReelsPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="explore/people" element={<SuggestedPeoplePage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="messages/:roomId" element={<MessagesPage />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route element={<AuthGuard />}>
            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/posts" element={<AdminPostsPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '@/layouts/main-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { AuthGuard, GuestGuard } from '@/layouts/auth-guard';
import HomePage from '@/features/home/pages/home-page';
import LoginPage from '@/features/auth/pages/login-page';
import RegisterPage from '@/features/auth/pages/register-page';

function App() {
  return (
    <BrowserRouter>
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
            {/* Add other routes like /profile, /explore here later */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

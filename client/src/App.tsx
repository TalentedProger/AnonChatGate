import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import ChatsPage from "@/pages/chats";
import ChatPage from "@/pages/chat";
import ProfilePage from "@/pages/profile";
import UserProfilePage from "@/pages/user-profile";
import EntryPage from "@/pages/entry";
import RegistrationPage from "@/pages/registration";
import NotFoundPage from "@/pages/not-found";
import { useAuth } from "@/lib/auth";
import { useEffect, useLayoutEffect } from "react";
import { initializeTelegramWebApp } from "@/lib/telegram";

// Initialize Telegram WebApp as early as possible (before React renders)
// This ensures fullscreen mode is activated immediately
initializeTelegramWebApp();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to entry if not authenticated
    if (!auth.user || !auth.token) {
      console.log('[ProtectedRoute] Not authenticated, redirecting to entry');
      setLocation('/entry');
    }
  }, [auth.user, auth.token, setLocation]);

  // Don't render if not authenticated
  if (!auth.user || !auth.token) {
    return null;
  }

  return <>{children}</>;
}

function InitialRedirect() {
  const [location, setLocation] = useLocation();
  const auth = useAuth();

  useEffect(() => {
    // Only redirect from root path
    if (location === '/') {
      // If not authenticated, go to entry
      if (!auth.user || !auth.token) {
        console.log('[InitialRedirect] Not authenticated, redirecting to entry');
        setLocation('/entry');
      }
      // If authenticated, stay on home page (it's protected anyway)
    }
  }, [location, auth.user, auth.token, setLocation]);

  return null;
}

function Router() {
  return (
    <>
      <InitialRedirect />
      <Switch>
        {/* Public routes */}
        <Route path="/entry" component={EntryPage} />
        <Route path="/register" component={RegistrationPage} />
        
        {/* Protected routes with layout */}
        <Route path="/chats">
          <ProtectedRoute>
            <Layout>
              <ChatsPage />
            </Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/chat">
          <ProtectedRoute>
            <Layout>
              <ChatPage />
            </Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/profile">
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        </Route>
        <Route path="/user/:userId">
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        </Route>
        <Route path="/">
          <ProtectedRoute>
            <Layout>
              <HomePage />
            </Layout>
          </ProtectedRoute>
        </Route>
        <Route path="*">
          <ProtectedRoute>
            <Layout>
              <NotFoundPage />
            </Layout>
          </ProtectedRoute>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  // Re-initialize on mount to ensure fullscreen is active
  useLayoutEffect(() => {
    initializeTelegramWebApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

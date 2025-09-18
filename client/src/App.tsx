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
import EntryPage from "@/pages/entry";
import RegistrationPage from "@/pages/registration";
import NotFoundPage from "@/pages/not-found";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // In dev mode, auto-authenticate with dev user for now
    if (import.meta.env.DEV && !auth.user) {
      auth.setAuthData({
        user: {
          id: 999999,
          anonName: 'Student_999999',
          status: 'approved',
          createdAt: new Date().toISOString()
        },
        status: 'approved',
        token: 'dev_token',
        refreshToken: 'dev_refresh_token'
      });
    }
  }, []);

  // Show entry page for users without profiles in production
  if (!import.meta.env.DEV && !auth.user && !location.startsWith('/entry') && !location.startsWith('/register')) {
    setLocation('/entry');
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <AuthWrapper>
      <Switch>
        {/* Full-screen routes without layout */}
        <Route path="/entry" component={EntryPage} />
        <Route path="/register" component={RegistrationPage} />
        
        {/* Main app routes with layout */}
        <Route path="/">
          <Layout>
            <HomePage />
          </Layout>
        </Route>
        <Route path="/chats">
          <Layout>
            <ChatsPage />
          </Layout>
        </Route>
        <Route path="/chat">
          <Layout>
            <ChatPage />
          </Layout>
        </Route>
        <Route path="/profile">
          <Layout>
            <ProfilePage />
          </Layout>
        </Route>
        <Route path="*">
          <Layout>
            <NotFoundPage />
          </Layout>
        </Route>
      </Switch>
    </AuthWrapper>
  );
}

function App() {
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

import { Switch, Route } from "wouter";
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

function Router() {
  return (
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

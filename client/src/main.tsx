import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Clear old cache and invalid auth data on app start
const APP_VERSION = '2.0.1'; // Increased to force cache clear
const STORED_VERSION_KEY = 'app_version';

function clearOldCache() {
  const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
  
  if (storedVersion !== APP_VERSION) {
    console.log(`[App] Version changed from ${storedVersion} to ${APP_VERSION}, clearing cache...`);
    
    // Clear all localStorage except dev_user_id (for development persistence)
    const devUserId = localStorage.getItem('dev_user_id');
    localStorage.clear();
    if (devUserId) {
      localStorage.setItem('dev_user_id', devUserId);
    }
    
    // Set new version
    localStorage.setItem(STORED_VERSION_KEY, APP_VERSION);
    
    console.log('[App] Cache cleared successfully');
  } else {
    console.log(`[App] Version ${APP_VERSION} - cache valid`);
  }
}

// Clear cache before rendering
clearOldCache();

createRoot(document.getElementById("root")!).render(<App />);

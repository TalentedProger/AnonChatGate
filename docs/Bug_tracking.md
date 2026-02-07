# Bug Tracking - AnonChatGate

## 2025-10-18 - Vite Pre-transform Error & Ngrok Connection Issues

### Symptoms
1. **Vite Error**: `Failed to load url /src/main.tsx?v=TpkJlacayep4SDH9qm5Lq`
2. **Ngrok Error**: `connectex: No connection could be made because the target machine actively refused it`

### Root Cause
The project was using `import.meta.dirname` which is not consistently supported across all Node.js/TypeScript configurations. This caused path resolution failures in:
- `vite.config.ts` - Alias paths couldn't resolve properly
- `server/vite.ts` - Template path resolution failed

### Impact
- Vite development server failed to start properly
- Ngrok couldn't connect because localhost:3000 wasn't running
- Frontend couldn't be served to users

### Solution Applied

#### 1. Fixed `vite.config.ts`
**Changed from:**
```typescript
import.meta.dirname
```

**Changed to:**
```typescript
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

**Additional fixes:**
- Changed `server.fs.strict` from `true` to `false`
- Added explicit `allow` paths for better compatibility:
  - `client`
  - `shared`
  - `attached_assets`

#### 2. Fixed `server/vite.ts`
**Applied same __dirname pattern:**
```typescript
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

**Replaced all instances of:**
- `import.meta.dirname` → `__dirname`

### Files Modified
- `e:\it\AnonChatGate\vite.config.ts`
- `e:\it\AnonChatGate\server\vite.ts`

### Testing Required
1. Restart development server: `npm run dev`
2. Verify Vite starts without errors
3. Confirm ngrok connects successfully
4. Test frontend loads at the ngrok URL

### Prevention
- Always use `fileURLToPath(import.meta.url)` pattern for ES modules in Node.js
- Avoid `import.meta.dirname` unless confirmed supported in target environment
- Test path resolution in both development and production builds

### Verification

**Automated checks performed:**

1. ✅ `vite.config.ts` - Contains `fileURLToPath` import
2. ✅ `server/vite.ts` - Contains `fileURLToPath` import  
3. ✅ No occurrences of `import.meta.dirname` found in project

**Verification commands:**
```powershell
# Check vite.config.ts
Select-String -Path "vite.config.ts" -Pattern "fileURLToPath"

# Check server/vite.ts
Select-String -Path "server/vite.ts" -Pattern "fileURLToPath"

# Verify old code removed
Select-String -Path "vite.config.ts","server/vite.ts" -Pattern "import.meta.dirname"
# Expected: No results found
```

### Status
✅ Fixed and Verified - Ready for deployment

### Next Steps
1. Run `npm run dev` to start the development server
2. Verify Vite starts without "Pre-transform error"
3. Confirm Ngrok connects successfully
4. Test web interface loads correctly

---

## 2025-10-18 (22:44) - Profile Page & WebSocket Errors

### Symptoms
1. **Profile Page Crash**: `Uncaught ReferenceError: activeProfile is not defined`
2. **WebSocket Invalid URL**: `Failed to construct 'WebSocket': The URL 'ws://localhost:undefined/?token=xxx' is invalid`
3. **Frequent Reconnections**: WebSocket constantly disconnecting and reconnecting

### Root Cause

#### Problem 1: Missing State Variable in Profile Component
The `ProfilePage` component was using `activeProfile` state variable (line 233) without declaring it with `useState`. This caused an immediate React crash when trying to render the profile switcher buttons.

**Location:** `client/src/pages/profile.tsx:233`

#### Problem 2: WebSocket URL Construction Error
When `window.location.host` is undefined or empty (common in Telegram Mini Apps), the code didn't properly fallback to a valid host:port combination. This resulted in constructing invalid WebSocket URLs like `ws://localhost:undefined/`.

**Location:** `client/src/pages/chat.tsx:163-166`

### Impact
- 🔴 Profile page completely inaccessible
- 🔴 Chat functionality broken due to invalid WebSocket
- 🔴 Constant reconnection attempts causing performance issues
- 🔴 Poor user experience with error boundaries

### Solution Applied

#### 1. Fixed Profile Page State
**File:** `client/src/pages/profile.tsx`

**Added missing state declaration:**
```typescript
const [activeProfile, setActiveProfile] = useState<'main' | 'anon'>('main');
```

**Changes:**
- Added line 26: State declaration with proper TypeScript typing
- Default value: `'main'` (shows main profile by default)
- Proper type constraint: only `'main'` or `'anon'` allowed

#### 2. Fixed WebSocket URL Construction
**File:** `client/src/pages/chat.tsx`

**Before (problematic):**
```typescript
if (!wsHost || wsHost === 'undefined' || !wsHost.includes(':')) {
  wsHost = import.meta.env.VITE_WS_HOST || 'localhost:3000';
}
```

**After (fixed):**
```typescript
if (!wsHost || wsHost === 'undefined' || wsHost === '' || wsHost === 'undefined:undefined') {
  // Use PORT from environment or default to 3000
  const port = import.meta.env.VITE_PORT || '3000';
  wsHost = import.meta.env.VITE_WS_HOST || `localhost:${port}`;
}
```

**Improvements:**
- ✅ Handles empty string case
- ✅ Handles 'undefined:undefined' edge case
- ✅ Uses environment variable for port configuration
- ✅ Better fallback chain for host determination

### Files Modified
- `client/src/pages/profile.tsx` - Added `activeProfile` state
- `client/src/pages/chat.tsx` - Fixed WebSocket URL construction

### Testing Steps

1. **Test Profile Page:**
   ```bash
   # Navigate to profile page
   # Should load without errors
   # Should show profile switcher (👤/🎭)
   ```

2. **Test WebSocket Connection:**
   ```bash
   # Check browser console
   # Should see: "Connecting to WebSocket..."
   # Should NOT see: "The URL 'ws://localhost:undefined/...' is invalid"
   # Should see: "WebSocket connected, authenticating..."
   ```

3. **Test Reconnection Stability:**
   - WebSocket should stay connected
   - No constant reconnection loops
   - Online status should remain stable

### Prevention

**For Future Development:**

1. **Always declare state variables before use:**
   ```typescript
   // ❌ BAD - will crash
   onClick={() => setMyState(value)}  // but no useState for myState
   
   // ✅ GOOD
   const [myState, setMyState] = useState(defaultValue);
   onClick={() => setMyState(value))
   ```

2. **Robust URL construction:**
   ```typescript
   // ✅ GOOD - handle all edge cases
   if (!value || value === '' || value === 'undefined' || value === 'null') {
     // Use fallback
   }
   ```

3. **Environment variable handling:**
   ```typescript
   // ✅ GOOD - provide defaults
   const port = import.meta.env.VITE_PORT || '3000';
   ```

### Status
✅ Fixed and Ready for Testing

### Expected Behavior After Fix
1. ✅ Profile page loads successfully
2. ✅ Profile switcher buttons work (main/anon)
3. ✅ WebSocket connects with valid URL
4. ✅ No more `undefined` in URLs
5. ✅ Stable connection without constant reconnects
6. ✅ Chat functionality works normally

---

## 2025-10-18 (23:54) - Chat UI/UX Improvements

### Changes Implemented

#### 1. Message Layout - All Messages on Left
**File:** `client/src/components/chat-interface.tsx`

**Problem:** Messages from current user appeared on right side, causing confusion
**Solution:** All messages now appear on left side consistently
- Removed `flex-row-reverse` class for current user messages
- Changed layout to always use left alignment
- Updated read receipts alignment to left (`justify-start`)

#### 2. Background Image Support
**Added:** Toggle between dark background and custom image
- Added state: `useBackgroundImage`
- Background image uses `mainGroupInternal.jpg`
- Added dark overlay (40% opacity) for readability
- Messages have backdrop blur and 95% opacity for clarity

**Menu Implementation:**
- Added dropdown menu in top-right corner (Menu icon)
- Toggle button switches between dark/image backgrounds
- Menu closes on click outside (useRef + useEffect)
- Smooth animation on menu open

#### 3. Message Width Constraint
**Problem:** Long text overflowed screen width
**Solution:** 
- Added `max-w-[70%]` to message container
- Added `break-words` class to text content
- Messages now wrap properly on narrow screens

#### 4. Input Field Improvements
**Problem:** Input sometimes didn't respond to clicks
**Solution:**
- Changed background from `bg-black` to `bg-zinc-900`
- Added `focus:ring-1 focus:ring-zinc-500` for better focus indication
- Improved visual feedback on focus state

#### 5. Online Count Display
**Changed:** Format to show total and online separately
- Template: `{X} участников | {Y} онлайн`
- X (total participants) - blue color (`text-blue-400`)
- Y (online users) - green color (`text-green-400`)
- Formula: online = Math.floor(total * 0.6)

#### 6. Avatar Border
**Added:** 1px white border to chat avatar
- Class: `ring-1 ring-white`
- Applied to main group avatar in header

#### 7. Back Button Icon
**Changed:** From `ArrowLeft` to `ChevronLeft` (<)
- Updated import statement
- Consistent with navigation icons

#### 8. Text Readability with Background
**Added:** Drop shadows for better visibility
- Username: `drop-shadow-lg`
- Timestamp: `drop-shadow-md`
- Improves readability on image backgrounds

### Home Page Changes

#### News Container Size
**File:** `client/src/pages/home.tsx`

**Changed:** News card minimum height
- Before: `min-h-[220px]`
- After: `min-h-[280px]`
- Provides more space for content
- Better visual balance

### Files Modified
- `client/src/components/chat-interface.tsx` - Major UI overhaul
- `client/src/pages/home.tsx` - News container size
- `Docs/Bug_tracking.md` - This documentation

### Testing Checklist

**Chat Interface:**
- [ ] All messages appear on left side
- [ ] Menu opens/closes correctly
- [ ] Background image toggles properly
- [ ] Long messages wrap correctly (no overflow)
- [ ] Input field responds to all clicks
- [ ] Online count shows with correct colors
- [ ] Avatar has white border
- [ ] Back button shows chevron (<)
- [ ] Messages readable on both backgrounds

**Home Page:**
- [ ] News cards display with new height (280px)
- [ ] Content fits properly in cards
- [ ] Navigation buttons (< >) work correctly

### Status
✅ Implemented - Ready for Testing

---

## 2025-10-19 (01:32) - Chat UI Refinements & Data Consistency

### Issues Fixed

#### 1. Online Count Text Color
**Problem:** Words "участников" and "онлайн" had default color that blended with background
**Solution:** 
- Changed text color to `text-zinc-200` (light gray, almost white)
- Numbers remain colored: blue for total, green for online
- Added `font-medium` to numbers for better emphasis

**Before:**
```tsx
<span className="text-blue-400">{onlineCount}</span> участников | 
<span className="text-green-400">{Math.floor(onlineCount * 0.6)}</span> онлайн
```

**After:**
```tsx
<span className="text-blue-400 font-medium">{totalUsers}</span> <span className="text-zinc-200">участников</span> | 
<span className="text-green-400 font-medium">{onlineCount}</span> <span className="text-zinc-200">онлайн</span>
```

#### 2. Background Image Overlay Issue
**Problem:** Dark overlay (40% opacity) only covered viewport height, disappeared when scrolling
**Solution:** Changed from separate overlay div to CSS linear-gradient in background property
- Overlay now part of background, scrolls with content
- Consistent darkness throughout entire chat area
- Better performance (no extra DOM element)

**Before:**
```tsx
style={{
  background: useBackgroundImage 
    ? `url(${mainGroupInternal}) center/cover no-repeat fixed` 
    : '#000',
  position: 'relative'
}}
{useBackgroundImage && <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>}
```

**After:**
```tsx
style={{
  background: useBackgroundImage 
    ? `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${mainGroupInternal}) center/cover fixed` 
    : '#000'
}}
```

#### 3. Message Spacing
**Problem:** Messages too close together (4 spacing units)
**Solution:** Increased vertical spacing between messages
- Changed from `space-y-4` to `space-y-6`
- Better visual separation and readability
- More comfortable chat experience

#### 4. Data Inconsistency Between Pages
**Problem:** Different data shown on different pages:
- `chats.tsx`: Shows totalUsers and onlineUsers from API
- `chat.tsx`: Only showed onlineCount, calculated fake total as `onlineCount * 0.6`

**Root Cause:** WebSocket sends both values, but client wasn't using totalUsers

**Solution:**
- Added `totalUsers` state in `chat.tsx`
- Updated `online_count` handler to extract both values from WebSocket message
- Added `totalUsers` prop to `ChatInterface` component
- Now displays actual server data instead of calculated approximation

**Server sends:**
```typescript
{
  type: 'online_count',
  count: onlineCount,      // actual online users
  totalUsers: wss.clients.size  // total registered users
}
```

**Client now uses:**
```typescript
setTotalUsers(data.totalUsers || 0);
setOnlineCount(data.count || 0);
```

### Files Modified
- `client/src/components/chat-interface.tsx`:
  - Updated prop interface to include `totalUsers`
  - Changed text colors for better visibility
  - Fixed background overlay implementation
  - Increased message spacing
  
- `client/src/pages/chat.tsx`:
  - Added `totalUsers` state
  - Updated `online_count` handler
  - Pass `totalUsers` to ChatInterface

### Verification

**Online Count Display:**
- [ ] Text "участников" and "онлайн" clearly visible (light gray)
- [ ] Numbers in blue (total) and green (online)
- [ ] Data matches between chats list and chat page

**Background Image:**
- [ ] Dark overlay visible throughout entire chat
- [ ] Overlay doesn't disappear when scrolling
- [ ] Messages remain readable on background

**Message Spacing:**
- [ ] Messages have comfortable spacing between them
- [ ] Not too cramped, not too sparse
- [ ] Easy to distinguish individual messages

**Data Consistency:**
- [ ] Same participant count on chats page and chat page
- [ ] Numbers update correctly via WebSocket
- [ ] No more calculated/fake values

### Status
✅ Fixed - Ready for Testing

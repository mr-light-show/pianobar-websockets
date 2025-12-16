# WebSocket Deadlock Fix - Testing Guide

## Problem Addressed
**Critical Bug:** When WebSocket actions (like station rename) fail due to API restrictions, pianobar would completely freeze and become unresponsive. This was caused by calling `BarUiMsg()` from the WebSocket thread, which caused a deadlock with the main CLI thread.

## Solution Summary
1. Created **silent API wrappers** (`BarWsPianoCall`, `BarWsTransformIfShared`) that:
   - Use `debugPrint()` instead of `BarUiMsg()` (no terminal I/O)
   - Return error messages via `char **errorMsg` parameter
   - Safe to call from WebSocket thread

2. Added **error event emission** (`BarSocketIoEmitError`) to notify clients of failures

3. Updated **frontend** to listen for error events and display toast notifications

## Testing Instructions

### Prerequisites
- pianobar running with WebSocket enabled
- Access to a shared station (not creator)

### Test Case 1: Shared Station Rename (Primary Test)
This reproduces the original deadlock bug.

**Steps:**
1. Start pianobar: `./pianobar`
2. Open WebUI in browser: `http://localhost:8080`
3. Find a shared station (one you didn't create)
4. Try to rename the shared station via WebUI

**Expected Behavior (After Fix):**
- ✅ WebUI shows error toast: "❌ Call not allowed" (or similar)
- ✅ pianobar CLI remains responsive (can press 'p', 'q', etc.)
- ✅ WebUI remains responsive (can try other actions)
- ✅ No application freeze

**Expected Behavior (Before Fix - DO NOT TEST):**
- ❌ pianobar freezes completely
- ❌ CLI stops responding
- ❌ WebUI stops responding
- ❌ Must kill process with Ctrl+C or `kill -9`

### Test Case 2: Network Error Handling
**Steps:**
1. Disconnect network connection
2. Try any WebSocket action (rename station, add music, etc.)

**Expected Behavior:**
- ✅ Error toast shown with network error message
- ✅ Application remains responsive

### Test Case 3: Invalid Station Operations
**Steps:**
1. Try to delete a station that doesn't exist
2. Try to add music to a QuickMix station (if restricted)
3. Try to set station mode on a QuickMix station

**Expected Behavior:**
- ✅ Appropriate error toast shown for each
- ✅ Application remains responsive

### Test Case 4: Multiple Error Scenarios
**Steps:**
1. Try several operations that will fail in quick succession
2. Verify each shows an error toast
3. Verify application remains responsive throughout

**Expected Behavior:**
- ✅ All errors shown as toasts (may stack or replace each other)
- ✅ Error toasts stay visible for 7 seconds (longer than normal 5 seconds)
- ✅ Application never freezes

## Verification Checklist

- [ ] Shared station rename shows error toast (not freeze)
- [ ] CLI commands still work after error ('p', 'q', 's', etc.)
- [ ] WebSocket commands still work after error
- [ ] Error message is user-friendly
- [ ] Error toast has ❌ emoji prefix
- [ ] Error toast stays visible for 7 seconds
- [ ] Can perform multiple operations after an error
- [ ] No "Interrupted" or terminal messages from WebSocket thread

## Code Changes Summary

### Backend
- `src/ui.h` / `src/ui.c`: Added `BarWsPianoCall()` - silent version of `BarUiPianoCall()`
- `src/ui_act.h` / `src/ui_act.c`: Added `BarWsTransformIfShared()` - silent version of `BarTransformIfShared()`
- `src/websocket/protocol/socketio.h` / `socketio.c`: Added `BarSocketIoEmitError()`
- `src/websocket/protocol/socketio.c`: Updated 13 handlers to use silent functions:
  - `BarSocketIoHandleRenameStation()`
  - `BarSocketIoHandleAddMusic()`
  - `BarSocketIoHandleGetGenres()`
  - `BarSocketIoHandleAddGenre()`
  - `BarSocketIoHandleAddShared()`
  - `BarSocketIoHandleGetStationModes()`
  - `BarSocketIoHandleSetStationMode()`
  - `BarSocketIoHandleGetStationInfo()`
  - `BarSocketIoHandleDeleteSeed()`
  - `BarSocketIoHandleDeleteFeedback()`
  - `BarSocketIoHandleSearchMusic()`
  - `BarSocketIoHandleSetQuickMix()`
  - `BarSocketIoHandleDeleteStation()`
  - `BarSocketIoHandleCreateStationFrom()`

### Frontend
- `webui/src/app.ts`: 
  - Added error event listener
  - Enhanced `showToast()` to show errors for 7 seconds

## Debug Output
When testing, you should see debug output like:
```
Socket.IO: Renaming station from 'Spa Radio' to 'Spa'
WebSocket: Transforming shared station...
WebSocket: Piano API Error: Call not allowed.
WebSocket: Emit event='error' (data=...)
```

**Not** like before:
```
Socket.IO: Renaming station from 'Spa Radio' to 'Spa'
Error: Call not allowed.  <-- This was printed to terminal, causing deadlock
```

## Success Criteria
✅ All WebSocket operations that call Piano API now use silent wrappers
✅ No `BarUiMsg()` calls from WebSocket thread
✅ All errors emit 'error' event to clients
✅ Frontend shows user-friendly error toasts
✅ Application never freezes or deadlocks
✅ Both CLI and WebUI remain functional after errors


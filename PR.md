# Critical Bug Fixes and UX Improvements

## Summary

This PR fixes four critical issues and adds user-friendly error messages:
1. **WebSocket Deadlock** - Application would freeze when API calls failed from WebSocket thread
2. **Volume Slider Bounce** - Slider would jump around while dragging due to receiving its own broadcast updates
3. **Volume Conversion Bug** - Slider would jump to wrong values due to mathematical error in `dbToSlider()`
4. **Progress Bar Pause Bug** - Progress bar would show incorrect time on page refresh when paused
5. **User-Friendly Error Messages** - Generic errors replaced with helpful, contextual messages

## Problem Description

### Issue 1: WebSocket Deadlock ⚠️ CRITICAL

When WebSocket actions (e.g., station rename) failed due to API restrictions, **pianobar would completely freeze**:
- CLI stops responding to all commands (p, q, s, etc.)
- WebSocket stops processing requests
- Application must be force-killed

**Root cause:** WebSocket handlers called `BarUiMsg()` which writes to terminal, causing a deadlock when the main CLI thread holds the terminal lock.

Example:
```
Socket.IO: Renaming station 'Spa Radio' to 'Spa'
Error: Call not allowed.  ← Terminal I/O from WebSocket thread = DEADLOCK
[Application frozen - must kill -9]
```

### Issue 2: Volume Slider Bounce
When a user dragged the volume slider, the following would happen:
- User moves slider to 21%
- Frontend sends `volume.set(21%)`
- Backend converts to -13dB and broadcasts **immediately** to **all clients**
- Frontend receives broadcast and updates slider → **causes bounce/jump**
- User experiences janky, unresponsive slider behavior

Example logs showing the bounce:
```
Socket.IO: Action 'volume.set' → volume=-13dB (21%)
Socket.IO: Emit event='volume'
WebSocket: Broadcasting to 2 clients: 2[ "volume", -13 ]
```

### Issue 3: Volume Conversion Bug
The `dbToSlider()` function had an incorrect formula that failed to properly invert the `sliderToDb()` function:

**Incorrect formula:**
```typescript
const normalized = Math.sqrt(1 - (db / -40));  // ❌ WRONG
```

This caused dramatic slider jumps:
- User sets slider to **5%**
- Backend correctly stores **-32dB**
- Frontend receives -32dB and incorrectly converts to **22%**
- Slider jumps from 5% to 22%!

### Issue 4: Progress Bar Pause Bug

When music was paused and the page refreshed, the progress bar showed incorrect time:
- **CLI correctly showed:** `#   03:48/05:03` (paused at 3:48)
- **WebUI incorrectly showed:** `5:04 ----- 5:04` (jumped to end)

**Root cause:** WebSocket code calculated elapsed time from wall-clock (`now - songStartTime`) which continued advancing during pause, while CLI correctly used `player->songPlayed` which freezes during pause.

### Issue 5: Generic Error Messages

When operations failed, users saw unhelpful generic errors:
- "Call not allowed" (What call? Why not?)
- "Network error: ..." (What should I do?)
- No visual feedback in WebUI (errors only in logs)

## Solution

### 1. Silent API Wrappers to Prevent Deadlock

Created thread-safe versions of Piano API functions that don't use terminal I/O:

**Backend (`src/ui.c`, `src/ui_act.c`):**
- `BarWsPianoCall()` - Silent version of `BarUiPianoCall()`
  - Uses `debugPrint()` instead of `BarUiMsg()` (no terminal I/O)
  - Returns error messages via `char **errorMsg` parameter
  - Safe to call from WebSocket thread
- `BarWsTransformIfShared()` - Silent version of `BarTransformIfShared()`
  - No terminal I/O, returns error info

**Updated 13 WebSocket handlers** to use silent versions:
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

**Benefits:**
- ✅ Eliminates deadlock - application stays responsive
- ✅ CLI and WebSocket work independently
- ✅ Errors handled gracefully with user feedback

### 2. User-Friendly Error Messages

Created dedicated error translation layer:

**New Files:**
- `src/websocket/protocol/error_messages.h` - Function declaration
- `src/websocket/protocol/error_messages.c` - Translation logic

**Translation Examples:**
- "Call not allowed" → "Station cannot be renamed (shared stations cannot be modified)"
- "Network error" → "Unable to connect to Pandora (check your network connection)"
- "Invalid auth token" → "Authentication failed (session may have expired)"

**Frontend (`webui/src/app.ts`):**
- Added error event listener
- Displays toast notifications with ❌ prefix
- Errors stay visible for 7 seconds (vs 5 seconds for normal messages)

**Benefits:**
- ✅ Users understand WHY operations failed
- ✅ Contextual hints on how to fix issues
- ✅ Consistent error format across all operations

### 3. Debounced Volume Broadcasts

Instead of broadcasting immediately on every volume change, the backend now:
- Applies the volume change immediately (audio responds instantly)
- Starts/resets a 500ms timer
- Only broadcasts when the timer expires (no changes for 500ms)
- Sends the **current volume** to all clients

**Benefits:**
- ✅ Eliminates slider bounce during dragging
- ✅ Reduces network traffic (multiple rapid changes → single broadcast)
- ✅ Ensures final value accuracy (reads current volume at broadcast time)
- ✅ All clients eventually sync to the same value

### 4. Corrected Volume Conversion Formula

Fixed the mathematical inversion in `dbToSlider()`:

**Correct formula:**
```typescript
const normalized = 1 - Math.sqrt(db / -40);  // ✅ CORRECT
```

**Mathematical proof:**
- Forward: `db = -40 × (1 - normalized)²`
- Solving for normalized: `db / -40 = (1 - normalized)²`
- Taking square root: `sqrt(db / -40) = 1 - normalized`
- Rearranging: `normalized = 1 - sqrt(db / -40)` ✓

**Roundtrip accuracy:**
- 5% → -32dB → 5% ✓ (was 22% ❌)
- 25% → -10dB → 25% ✓
- 50% → 0dB → 50% ✓
- All test cases pass within ±1% (acceptable rounding)

### 5. Use Player State for Progress Tracking

Simplified progress tracking to use player's authoritative state:

**Before (Broken):**
- CLI: Uses `player->songPlayed` ✓
- WebSocket: Calculates `now - songStartTime` ✗ (wrong during pause)

**After (Fixed):**
- Both use `player->songPlayed` - single source of truth

**Changes:**
- `BarWebsocketGetElapsed()` - Now directly reads `player->songPlayed`
- `BarWebsocketBroadcastProgress()` - Simplified to use player's time (removed 33 lines of pause tracking)
- `BarWebsocketBroadcastSongStart()` - Removed obsolete field initialization

**Benefits:**
- ✅ CLI and WebUI always show identical times
- ✅ Correct time on page refresh when paused
- ✅ Simpler code (removed ~55 lines of complex logic)
- ✅ Player thread handles all pause/resume complexity

## Changes

### Backend (`src/websocket/`)

**`websocket.h`:**
- Added `delayedVolumeBroadcast` structure to `BarWsContext_t`
- Added `volumeBroadcastMutex` for thread safety

**`websocket.c`:**
- Implemented `BarWsScheduleVolumeBroadcast()` - schedules/resets 500ms timer
- Implemented `BarWsProcessVolumeBroadcast()` - checks and executes expired broadcasts
- Integrated delayed broadcast processing into WebSocket thread main loop
- Reads `app->settings.volume` at broadcast time (not stored value)
- Added mutex initialization and cleanup

**`socketio.c`:**
- Modified `volume.set` action handler to use debounced broadcasts
- Removed immediate `BarSocketIoEmitVolume()` call
- Now calls `BarWsScheduleVolumeBroadcast(ctx, 500)`

### Frontend (`webui/src/`)

**`volume-control.ts`:**
- Fixed `dbToSlider()` conversion formula (line 26)
- Changed from `Math.sqrt(1 - (db / -40))` to `1 - Math.sqrt(db / -40)`

**`volume-control.test.ts`:**
- Added comprehensive "conversion roundtrip accuracy" test suite
- 15 test cases covering full volume range (0-100%)
- Tests for multiple roundtrips, custom maxGain, and edge cases
- Total: 20 new tests, all passing ✓

## Testing

### Unit Tests
```
✓ 48 tests passed
✓ 0% → -40dB → 0% (diff: 0%)
✓ 5% → -32dB → 5% (diff: 0%)
✓ 10% → -26dB → 10% (diff: 0%)
✓ 25% → -10dB → 25% (diff: 0%)
✓ 50% → 0dB → 50% (diff: 0%)
✓ 75% → 5dB → 75% (diff: 0%)
✓ 100% → 10dB → 100% (diff: 0%)
```

### Manual Testing
A comprehensive testing guide has been created in `TEST_VOLUME_DEBOUNCE.md`:
- Single client: Smooth dragging, no bounce ✓
- Multiple clients: Sync to final value after 500ms ✓
- Network traffic: Only one broadcast per drag session ✓

## Expected Behavior

**Before:**
1. User drags slider → slider bounces and jumps
2. Slider ends up at wrong value
3. Network flooded with rapid broadcasts

**After:**
1. User drags slider → smooth, responsive movement
2. Audio volume changes immediately
3. After 500ms: All clients receive final value
4. Slider stays stable at correct position ✓

## Files Modified

### Deadlock Fix
- `src/ui.h` / `src/ui.c` - Added `BarWsPianoCall()`
- `src/ui_act.h` / `src/ui_act.c` - Added `BarWsTransformIfShared()`
- `src/websocket/protocol/socketio.c` - Updated 13 handlers
- `src/websocket/protocol/socketio.h` - Added error emit declaration
- `webui/src/app.ts` - Added error event listener

### Error Messages
- `src/websocket/protocol/error_messages.h` - New file
- `src/websocket/protocol/error_messages.c` - New file
- `Makefile` - Added error_messages.o to build

### Volume Fix
- `src/websocket/core/websocket.h` - Added debounce structure
- `src/websocket/core/websocket.c` - Implemented debounce logic
- `src/websocket/protocol/socketio.c` - Updated action handler
- `webui/src/components/volume-control.ts` - Fixed conversion formula
- `webui/test/unit/volume-control.test.ts` - Added 20 new tests

### Progress Fix
- `src/websocket/core/websocket.c` - Simplified to use player state

### Documentation
- `ISSUE_WEBSOCKET_DEADLOCK.md` - Detailed deadlock analysis
- `DEADLOCK_FIX_TESTING.md` - Testing guide

## Stats

- **Backend:** +396 lines, -141 lines
- **Frontend:** +28 lines, -2 lines
- **Tests:** +153 lines (20 new tests)
- **Documentation:** +249 lines
- **Total:** 19 files changed, 826 insertions(+), 143 deletions(-)


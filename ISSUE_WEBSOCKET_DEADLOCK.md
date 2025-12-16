# Critical Bug: WebSocket Thread Deadlocks on Terminal I/O

## Summary

WebSocket actions that make API calls (rename station, add music, etc.) cause pianobar to freeze and stop responding to all commands (play, pause, quit) in both CLI and WebSocket modes.

## Root Cause

WebSocket handlers call `BarUiPianoCall()` which internally calls `BarUiMsg()` to print status messages to the terminal (stdout/stderr). When the main CLI thread is waiting for user input or has terminal I/O locks, this causes a **deadlock**:

```
Main Thread                    WebSocket Thread
-----------                    ----------------
Wait for terminal input    →   Calls BarSocketIoHandleRenameStation()
(stdin blocked)                └→ Calls BarTransformIfShared()
                                  └→ Calls BarUiMsg() to write to terminal
                                     └→ BLOCKED waiting for terminal lock
DEADLOCK: Both threads waiting on each other
```

## Affected Operations

All WebSocket operations that call `BarUiPianoCall()`:
1. `station.rename` ← **Reported by user**
2. `station.addMusic`
3. `station.addGenre`  
4. `station.addShared`
5. `station.getModes`
6. `station.setMode`
7. `station.getGenres`

## Example Logs

```
Socket.IO: Renaming station from 'Spa Radio' to 'Spa'
Error: Call not allowed.
Socket.IO: Failed to rename station
[... pianobar stops responding ...]
Socket.IO: HandleMessage called with: 2["action","playback.pause"]
[... never processes, thread is deadlocked ...]
```

## Technical Details

### Call Stack
```c
BarSocketIoHandleRenameStation()
  ↓
BarTransformIfShared()  // in ui_act.c
  ↓  
BarUiMsg(&app->settings, MSG_INFO, "Transforming station... ")
  ↓
Write to terminal → BLOCKS if main thread holds terminal lock
```

### `BarUiMsg()` Implementation (ui.c:94)
```c
void BarUiMsg(const BarSettings_t *settings, const BarUiMsg_t type,
        const char *format, ...) {
    // ... writes to stdout/stderr ...
    vfprintf(stream, format, fmtargs);  // ← CAN BLOCK!
    fflush(stream);
}
```

### `BarUiPianoCall()` Calls `BarUiMsg()` Multiple Times (ui.c:298)
```c
bool BarUiPianoCall(BarApp_t * const app, ...) {
    // ...
    BarUiMsg(&app->settings, MSG_NONE, "Error: %s\n", ...);  // Line 310
    BarUiMsg(&app->settings, MSG_NONE, "Interrupted.\n");     // Line 317
    BarUiMsg(&app->settings, MSG_NONE, "Network error: %s\n", ...);  // Line 320
    BarUiMsg(&app->settings, MSG_NONE, "Reauthentication required... ");  // Line 336
    // ... and more ...
}
```

## Solution

Create a **silent version** of Piano API calling functions for use by the WebSocket thread:

### Option A: Silent Wrapper (Recommended)
```c
/* Silent version of BarUiPianoCall for WebSocket thread */
bool BarWsPianoCall(BarApp_t * const app, const PianoRequestType_t type,
        void * const data, PianoReturn_t * const pRet, CURLcode * const wRet) {
    // Same logic as BarUiPianoCall but:
    // - Replace BarUiMsg() with debugPrint() or nothing
    // - No terminal I/O
    // - Can be called safely from any thread
}

/* Silent version for shared station transformation */
int BarWsTransformIfShared(BarApp_t *app, PianoStation_t *station) {
    if (!station->isCreator) {
        // No BarUiMsg, just call the API
        if (!BarWsPianoCall(app, PIANO_REQUEST_TRANSFORM_STATION, station, ...)) {
            return 0;
        }
    }
    return 1;
}
```

### Option B: Add Silent Flag
```c
bool BarUiPianoCall(BarApp_t * const app, const PianoRequestType_t type,
        void * const data, PianoReturn_t * const pRet, CURLcode * const wRet,
        bool silent) {  // ← New parameter
    if (!silent) {
        BarUiMsg(&app->settings, MSG_NONE, "Error: %s\n", ...);
    } else {
        debugPrint(DEBUG_WEBSOCKET, "Error: %s\n", ...);
    }
    // ...
}
```

## Files to Modify

1. **src/ui.c** - Add `BarWsPianoCall()` (silent version)
2. **src/ui.h** - Declare `BarWsPianoCall()`
3. **src/ui_act.c** - Add `BarWsTransformIfShared()` (silent version)
4. **src/ui_act.h** - Declare `BarWsTransformIfShared()`
5. **src/websocket/protocol/socketio.c** - Replace all `BarUiPianoCall()` with `BarWsPianoCall()`

## Impact

**Before Fix:**
- ✗ WebSocket actions that fail can deadlock entire application
- ✗ CLI becomes unresponsive
- ✗ Must kill pianobar process
- ✗ Affects production deployments

**After Fix:**
- ✓ WebSocket actions never block terminal I/O
- ✓ Failures are logged silently (debugPrint)
- ✓ Application remains responsive
- ✓ Both CLI and WebSocket continue to work

## Testing

1. Start pianobar with a shared station
2. Via WebSocket, attempt to rename the station
3. If API returns "Call not allowed", verify:
   - CLI still responds to 'p' (pause)
   - CLI still responds to 'q' (quit)
   - WebSocket still processes other commands

## Priority

**CRITICAL** - This is a blocking issue that makes WebSocket API unreliable and can freeze the entire application.

## Related Code

- `BarUiMsg()` - src/ui.c:94
- `BarUiPianoCall()` - src/ui.c:298
- `BarTransformIfShared()` - src/ui_act.c:72
- All WebSocket handlers in src/websocket/protocol/socketio.c


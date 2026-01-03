# System Volume Control & Pandora Disconnect/Reconnect

## Summary

This PR adds two major features:

1. **System Volume Control** - Control the operating system's master volume instead of internal player gain, allowing pianobar to integrate with system volume controls (keyboard volume keys, menu bar, system preferences).

2. **Pandora Disconnect/Reconnect** - Commands to gracefully disconnect from Pandora without quitting pianobar, and reconnect later. Useful for pausing sessions or handling connection issues.

---

## Feature 1: System Volume Control

### Configuration

Add to `~/.config/pianobar/config`:

```
volume_mode = system    # Control system volume (0-100%)
# or
volume_mode = player    # Control player gain in dB (default)
```

### Platform Support

| Platform | Primary Backend | Fallback |
|----------|-----------------|----------|
| **macOS** | CoreAudio API | osascript |
| **Linux** | libpulse (PulseAudio) | pactl CLI → amixer (ALSA) |

### Key Features

1. **Automatic backend detection** - Tries best available method at startup
2. **External change detection** - Polls system volume every 1 second to sync WebUI when user presses keyboard volume keys or uses system preferences
3. **Player at 0dB** - When using system volume, player outputs at neutral gain (no distortion)
4. **No state persistence** - System volume is not saved to config (OS manages it)
5. **Graceful fallback** - If system volume unavailable, falls back to player mode with warning

### Implementation

#### New Files

- `src/system_volume.h` - API declarations and `BarVolumeModeType` enum
- `src/system_volume.c` - Platform-specific implementations (~500 lines)

#### Backend Architecture

**macOS:**
```c
// CoreAudio (preferred) - direct API calls
AudioObjectGetPropertyData(device, &addr, ..., &volume);  // Get
AudioObjectSetPropertyData(device, &addr, ..., &volume);  // Set

// osascript fallback - for compatibility
popen("osascript -e 'output volume of (get volume settings)'", "r");
system("osascript -e 'set volume output volume 50'");
```

**Linux:**
```c
// libpulse (preferred - if HAVE_PULSEAUDIO defined)
pa_context_get_sink_info_by_name(ctx, "@DEFAULT_SINK@", callback, NULL);
pa_context_set_sink_volume_by_name(ctx, "@DEFAULT_SINK@", &volume, NULL, NULL);

// pactl CLI fallback
popen("pactl get-sink-volume @DEFAULT_SINK@ ...", "r");
system("pactl set-sink-volume @DEFAULT_SINK@ 50%");

// ALSA fallback (no PulseAudio)
popen("amixer sget Master ...", "r");
system("amixer sset Master 50%");
```

#### WebUI Integration

- **Volume mode awareness** - Frontend receives `volumeMode: "system" | "player"` from backend
- **Display format:**
  - System mode: `50%`
  - Player mode: `50% (-10dB)`
- **Value interpretation:**
  - System mode: Backend sends 0-100%, frontend uses directly
  - Player mode: Backend sends dB, frontend converts to slider position

#### System Volume Polling

When `volume_mode = system`, the WebSocket thread polls the OS volume every 1 second:

```c
static void BarWsPollSystemVolume(BarWsContext_t *ctx, BarApp_t *app) {
    // Only poll in system volume mode
    if (app->settings.volumeMode != BAR_VOLUME_MODE_SYSTEM) return;
    
    // Check if 1 second has elapsed
    time_t now = time(NULL);
    if (now - ctx->lastVolumePollTime < 1) return;
    ctx->lastVolumePollTime = now;
    
    // Read and broadcast if changed
    int currentVolume = BarSystemVolumeGet();
    if (currentVolume != ctx->lastPolledVolume) {
        ctx->lastPolledVolume = currentVolume;
        BarSocketIoEmitVolume(app, currentVolume);
    }
}
```

This syncs the WebUI slider when the user changes volume via:
- Keyboard volume keys
- System menu bar / tray
- Other applications

#### Thread Safety

The PulseAudio library backend (`libpulse`) uses a mutex to protect all operations:

```c
static pthread_mutex_t paMutex = PTHREAD_MUTEX_INITIALIZER;

static int pulseaudioGetVolume(void) {
    pthread_mutex_lock(&paMutex);
    // ... PulseAudio operations ...
    pthread_mutex_unlock(&paMutex);
    return result;
}
```

This is necessary because `BarSystemVolumeGet()` and `BarSystemVolumeSet()` can be called concurrently from:
- **Main thread** - CLI volume keys (`BarUiActVolUp/Down/Reset`)
- **WebSocket thread** - Remote commands and 1-second polling

---

## Feature 2: Pandora Disconnect/Reconnect

### Overview

Provides commands to disconnect from Pandora without quitting the application, and reconnect later. This is useful for:
- Pausing a session without closing pianobar
- Handling credential issues or network problems
- Testing the WebSocket server without active Pandora connection

### Commands

#### CLI Keys

| Key | Action | Visibility |
|-----|--------|------------|
| `D` | Disconnect from Pandora | Only when connected to Pandora |
| `R` | Reconnect to Pandora | Only when disconnected from Pandora |

#### WebSocket Actions

| Action | Description |
|--------|-------------|
| `app.pandora-disconnect` | Stop playback, clear station/playlist, disconnect from Pandora |
| `app.pandora-reconnect` | Re-authenticate with Pandora and fetch stations |

**Example - Disconnect:**
```javascript
ws.send('2["action","app.pandora-disconnect"]');
```
Response: All WebSocket clients are disconnected. Clients automatically reconnect and receive fresh state (no station selected, not playing).

**Example - Reconnect:**
```javascript
ws.send('2["action","app.pandora-reconnect"]');
```
Response: Re-authenticates with Pandora using saved credentials, fetches the station list, and broadcasts a `stations` event to all clients.

### Implementation

#### Context-Aware Dispatch

New context flags determine which commands are available:

```c
typedef enum {
    BAR_DC_UNDEFINED = 0,
    BAR_DC_GLOBAL = 1,              /* top-level action */
    BAR_DC_STATION = 2,             /* station selected */
    BAR_DC_SONG = 4,                /* song selected */
    BAR_DC_PANDORA_CONNECTED = 8,   /* connected to Pandora */
    BAR_DC_PANDORA_DISCONNECTED = 16, /* disconnected from Pandora */
} BarUiDispatchContext_t;
```

Commands are filtered based on connection state:
- Most commands (play, pause, rate, etc.) require `BAR_DC_PANDORA_CONNECTED`
- `D` (disconnect) requires `BAR_DC_PANDORA_CONNECTED`
- `R` (reconnect) requires `BAR_DC_PANDORA_DISCONNECTED`
- `q` (quit) always available

#### State Detection

```c
bool BarStateIsPandoraConnected(BarApp_t *app) {
    // User has a listenerId when logged in
    return (app->ph.user.listenerId != NULL);
}
```

#### Disconnect Action

`BarUiActPandoraDisconnect()`:
1. Stops playback (`BarUiDoPandoraDisconnect()`)
2. Clears station list and current station
3. Destroys Pandora handle (`PianoDestroy()`)
4. Reinitializes Pandora handle (`PianoInit()`)
5. Disconnects all WebSocket clients (they auto-reconnect)
6. Broadcasts empty state to reconnected clients

#### Reconnect Action

`BarUiActPandoraReconnect()`:
1. Re-authenticates with Pandora using stored credentials
2. Fetches station list
3. Broadcasts `stations` event to all WebSocket clients

#### WebSocket Client Handling

On disconnect, all WebSocket clients are gracefully closed:

```c
void BarWebsocketDisconnectAllClients(BarWsContext_t *ctx) {
    for (int i = 0; i < ctx->connectionCount; i++) {
        ctx->connections[i].pendingClose = true;
        lws_callback_on_writable(ctx->connections[i].wsi);
    }
}
```

The `pendingClose` flag ensures proper WebSocket close handshake before disconnection.

### WebUI Behavior

When disconnected from Pandora:
- Album art area shows "Not Connected to Pandora" message with reconnect button
- All playback controls hidden
- Bottom toolbar hidden
- Station menu hidden

When WebSocket disconnected:
- Album art area shows "Connection Lost" message with reconnect button

Both use a unified reconnect panel in the album art component:

```typescript
@customElement('album-art')
export class AlbumArt extends LitElement {
  @property({ type: Boolean }) showPandoraReconnect = false;
  @property({ type: Boolean }) showWebsocketReconnect = false;
  
  render() {
    if (this.showPandoraReconnect) {
      return html`<div class="reconnect-panel">
        <span class="icon material-icons">cloud_off</span>
        <h3>Not Connected to Pandora</h3>
        <button @click=${this.handlePandoraReconnect}>Reconnect</button>
      </div>`;
    }
    // ...
  }
}
```

---

## Files Modified

### Backend - System Volume

| File | Changes |
|------|---------|
| `src/system_volume.h` | New - API declarations |
| `src/system_volume.c` | New - Platform implementations (~500 lines) |
| `src/settings.h` | Added `volumeMode` to `BarSettings_t` |
| `src/settings.c` | Parse `volume_mode` config, skip saving volume in system mode |
| `src/main.c` | Init/cleanup system volume, set player to 0dB in system mode |
| `src/ui_act.c` | Volume up/down/reset use system volume when configured |
| `src/websocket/core/websocket.h` | Added polling state fields |
| `src/websocket/core/websocket.c` | Added `BarWsPollSystemVolume()` (1s interval) |
| `src/websocket/protocol/socketio.c` | Send `volumeMode`, handle system volume in actions |
| `src/websocket_bridge.c` | Read system volume for broadcasts |
| `Makefile` | Added system_volume.c, platform-specific link flags |

### Backend - Pandora Disconnect/Reconnect

| File | Changes |
|------|---------|
| `src/settings.h` | Added `BAR_KS_PANDORA_DISCONNECT`, `BAR_KS_PANDORA_RECONNECT` |
| `src/ui_act.c` | Implemented `BarUiActPandoraDisconnect`, `BarUiActPandoraReconnect` |
| `src/ui_act.h` | Added function declarations |
| `src/ui_dispatch.h` | Added `BAR_DC_PANDORA_CONNECTED/DISCONNECTED` context flags |
| `src/bar_state.c` | Added `BarStateIsPandoraConnected()` |
| `src/bar_state.h` | Added declaration |
| `src/main.c` | Context-aware command dispatch |
| `src/playback_manager.c` | Renamed stop function calls |
| `src/websocket/core/websocket.c` | Added `BarWebsocketDisconnectAllClients()`, `pendingClose` handling |
| `src/websocket/core/websocket.h` | Added `pendingClose` flag to connection struct |
| `src/websocket/protocol/socketio.c` | Added action mappings, context-aware dispatch |
| `src/websocket_bridge.c` | Added `BarWsBroadcastStations()` |
| `WEBSOCKET_API.md` | Documented new commands |

### Frontend

| File | Changes |
|------|---------|
| `webui/src/components/volume-control.ts` | Added `volumeMode` property, mode-aware display |
| `webui/src/components/album-art.ts` | Added reconnect panels for Pandora and WebSocket |
| `webui/src/app.ts` | Handle reconnect states, conditional UI rendering |

---

## Testing

### System Volume

```bash
# macOS - verify CoreAudio backend
./pianobar  # Should not show "falling back" warning

# Test external change detection
# 1. Start pianobar with volume_mode = system
# 2. Open WebUI
# 3. Press keyboard volume keys
# 4. WebUI slider should update within 1 second

# Test volume control
# 1. Move WebUI slider
# 2. System volume indicator should change
# 3. Other apps' audio should be affected

# Test CLI volume keys
# 1. Press ) to increase volume
# 2. Press ( to decrease volume
# 3. Press ^ to reset to 50%
```

### Pandora Disconnect/Reconnect

```bash
# Test disconnect
# 1. Start pianobar, select a station
# 2. Press 'D' in CLI
# 3. Playback stops, stations clear
# 4. Help menu shows only 'q', 'R', '!'
# 5. WebUI shows "Not Connected to Pandora"

# Test reconnect (CLI)
# 1. While disconnected, press 'R'
# 2. Should authenticate and fetch stations
# 3. WebUI updates with station list

# Test reconnect (WebUI)
# 1. While disconnected, click reconnect button in album art area
# 2. Should authenticate and fetch stations
# 3. Station list appears

# Test WebSocket disconnect recovery
# 1. While connected, restart pianobar server
# 2. WebUI shows "Connection Lost" with reconnect button
# 3. Click reconnect, connection restores
```

---

## Stats

- **New code:** ~800 lines (system_volume.c + pandora disconnect/reconnect)
- **Platform support:** macOS (CoreAudio/osascript), Linux (PulseAudio/pactl/ALSA)
- **CPU impact:** Negligible (~0.01ms per 1s poll for CoreAudio)

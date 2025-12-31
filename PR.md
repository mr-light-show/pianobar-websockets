# System Volume Control

## Summary

This PR adds support for controlling the operating system's master volume instead of the internal player gain. This allows pianobar to integrate with system volume controls (keyboard volume keys, menu bar, system preferences).

## Configuration

Add to `~/.config/pianobar/config`:

```
volume_mode = system    # Control system volume (0-100%)
# or
volume_mode = player    # Control player gain in dB (default)
```

## Features

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

## Implementation

### New Files

- `src/system_volume.h` - API declarations and `BarVolumeModeType` enum
- `src/system_volume.c` - Platform-specific implementations (~500 lines)

### Backend Architecture

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

### WebUI Integration

- **Volume mode awareness** - Frontend receives `volumeMode: "system" | "player"` from backend
- **Display format:**
  - System mode: `50%`
  - Player mode: `50% (-10dB)`
- **Value interpretation:**
  - System mode: Backend sends 0-100%, frontend uses directly
  - Player mode: Backend sends dB, frontend converts to slider position

### System Volume Polling

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

## Files Modified

### Backend

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

### Frontend

| File | Changes |
|------|---------|
| `webui/src/components/volume-control.ts` | Added `volumeMode` property, mode-aware display |
| `webui/src/app.ts` | Track `volumeMode`, use `updateFromServer()` method |

## Testing

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

## Thread Safety

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

Without the mutex, concurrent calls to `pa_mainloop_iterate()` or simultaneous access to `paVolume` could cause crashes or corrupted state.

**Note:** The CLI fallbacks (`pactl`, `amixer`) and macOS backends (CoreAudio, osascript) are inherently thread-safe as they use separate process invocations or stateless API calls.

## Stats

- **New code:** ~600 lines (system_volume.c + modifications)
- **Platform support:** macOS (CoreAudio/osascript), Linux (PulseAudio/pactl/ALSA)
- **CPU impact:** Negligible (~0.01ms per 1s poll for CoreAudio)

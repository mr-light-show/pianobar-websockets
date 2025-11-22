/*
Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

#include "../../main.h"
#include "../../debug.h"
#include "websocket.h"
#include "../protocol/socketio.h"
#include "../http/http_server.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <libwebsockets.h>
#include <json-c/json.h>

/* Forward declarations */
static void BarWebsocketBroadcast(const char *message, size_t len);
static void BarWebsocketProcessBroadcast(BarWsContext_t *ctx, BarWsMessage_t *msg);
static void* BarWebsocketThread(void *arg);

/* WebSocket protocol callback */
static int callback_websocket(struct lws *wsi, enum lws_callback_reasons reason,
                              void *user, void *in, size_t len) {
	BarApp_t *app = (BarApp_t *)lws_context_user(lws_get_context(wsi));
	char filepath[512];
	const char *webui_path;
	char *url;
	
	switch (reason) {
		case LWS_CALLBACK_HTTP:
			/* HTTP request received */
			url = (char *)in;
			
			/* Get webui path from settings, default to ./dist/webui */
			webui_path = app->settings.webuiPath;
			if (!webui_path || strlen(webui_path) == 0) {
				webui_path = "./dist/webui";
			}
			
			debugPrint(DEBUG_WEBSOCKET, "HTTP: Request for %s\n", url);
			
			/* Handle root path */
			if (strcmp(url, "/") == 0 || strlen(url) == 0) {
				return BarHttpServeIndex(wsi, webui_path);
			}
			
			/* Serve requested file */
			snprintf(filepath, sizeof(filepath), "%s%s", webui_path, url);
			return BarHttpServeFile(wsi, filepath);
			
		case LWS_CALLBACK_ESTABLISHED:
			/* New client connected */
			debugPrint(DEBUG_WEBSOCKET, "WebSocket: Client connected\n");
			break;
			
		case LWS_CALLBACK_CLOSED:
			/* Client disconnected */
			debugPrint(DEBUG_WEBSOCKET, "WebSocket: Client disconnected\n");
			break;
			
		case LWS_CALLBACK_RECEIVE:
			/* Received message from client */
			if (app && in && len > 0) {
				char *message = malloc(len + 1);
				if (message) {
					memcpy(message, in, len);
					message[len] = '\0';
					BarWebsocketHandleMessage(app, message, len, "socketio");
					free(message);
				}
			}
			break;
			
		case LWS_CALLBACK_SERVER_WRITEABLE:
			/* Ready to send data to client */
			break;
			
		default:
			break;
	}
	
	return 0;
}

/* WebSocket protocols */
static struct lws_protocols protocols[] = {
	{
		"socketio",
		callback_websocket,
		0,
		4096,
		0, NULL, 0
	},
	{
		"homeassistant",
		callback_websocket,
		0,
		4096,
		0, NULL, 0
	},
	{ NULL, NULL, 0, 0, 0, NULL, 0 } /* terminator */
};

/* Process broadcast message from main thread (runs in WS thread) */
static void BarWebsocketProcessBroadcast(BarWsContext_t *ctx, BarWsMessage_t *msg) {
	if (!ctx || !msg) {
		return;
	}
	
	/* Note: We can't access BarApp_t here safely, so we'll need to redesign
	 * broadcast messages to be self-contained or use a different approach */
	
	switch (msg->type) {
		case MSG_TYPE_BROADCAST_START:
			/* Song started */
			ctx->progress.isPlaying = true;
			/* TODO: Extract song data from msg->data and emit */
			break;
			
		case MSG_TYPE_BROADCAST_STOP:
			/* Song stopped */
			ctx->progress.isPlaying = false;
			/* TODO: Emit stop event */
			break;
			
		case MSG_TYPE_BROADCAST_PROGRESS: {
			/* Progress update - data contains elapsed time (unsigned int) */
			if (msg->data && msg->dataLen >= sizeof(unsigned int) * 2) {
				unsigned int *times = (unsigned int *)msg->data;
				unsigned int elapsed = times[0];
				unsigned int duration = times[1];
				/* TODO: Emit progress event with elapsed and duration */
			}
			break;
		}
			
		case MSG_TYPE_BROADCAST_VOLUME: {
			/* Volume changed - data contains volume (int) */
			if (msg->data && msg->dataLen >= sizeof(int)) {
				int volume = *(int *)msg->data;
				/* TODO: Emit volume event */
			}
			break;
		}
			
		case MSG_TYPE_BROADCAST_STATIONS:
			/* Station list changed */
			/* TODO: Emit stations event */
			break;
			
		default:
			break;
	}
}

/* WebSocket service thread - runs lws_service() loop */
static void* BarWebsocketThread(void *arg) {
	BarApp_t *app = (BarApp_t *)arg;
	if (!app || !app->wsContext) {
		return NULL;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	debugPrint(DEBUG_WEBSOCKET, "WebSocket: Thread started\n");
	
	while (ctx->threadRunning) {
		/* Service WebSocket (can block - we're in our own thread) */
		if (ctx->context) {
			lws_service(ctx->context, 50); /* 50ms is fine here */
		}
		
		/* Process broadcast queue from main thread */
		BarWsMessage_t *msg;
		while ((msg = BarWsQueuePop(&ctx->broadcastQueue, 0)) != NULL) {
			BarWebsocketProcessBroadcast(ctx, msg);
			BarWsMessageFree(msg);
		}
	}
	
	debugPrint(DEBUG_WEBSOCKET, "WebSocket: Thread stopped\n");
	return NULL;
}

/* Initialize WebSocket server */
bool BarWebsocketInit(BarApp_t *app) {
	struct lws_context_creation_info info;
	
	if (!app) {
		return false;
	}
	
	/* Allocate WebSocket context */
	app->wsContext = calloc(1, sizeof(BarWsContext_t));
	if (!app->wsContext) {
		fprintf(stderr, "WebSocket: Failed to allocate context\n");
		return false;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	/* Initialize libwebsockets */
	memset(&info, 0, sizeof(info));
	info.port = app->settings.websocketPort;
	info.protocols = protocols;
	info.user = app;
	info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
	/* Removed LWS_SERVER_OPTION_HTTP_HEADERS_SECURITY_BEST_PRACTICES_ENFORCE
	 * so we can use custom CSP for Google Fonts */
	
	ctx->context = lws_create_context(&info);
	if (!ctx->context) {
		fprintf(stderr, "WebSocket: Failed to create context on port %d\n",
		        app->settings.websocketPort);
		free(ctx);
		app->wsContext = NULL;
		return false;
	}
	
	ctx->initialized = true;
	ctx->maxConnections = 32;
	ctx->connections = calloc(ctx->maxConnections, sizeof(BarWsConnection_t));
	
	/* Initialize queues */
	BarWsQueueInit(&ctx->broadcastQueue, 100);
	BarWsQueueInit(&ctx->commandQueue, 50);
	
	/* Initialize mutex */
	pthread_mutex_init(&ctx->stateMutex, NULL);
	
	/* Set up Socket.IO broadcast callback */
	BarSocketIoSetBroadcastCallback(BarWebsocketBroadcast);
	
	fprintf(stderr, "WebSocket: Server started on port %d\n",
	        app->settings.websocketPort);
	
	/* Start WebSocket thread */
	ctx->threadRunning = true;
	if (pthread_create(&ctx->thread, NULL, BarWebsocketThread, app) != 0) {
		fprintf(stderr, "WebSocket: Failed to create thread\n");
		
		/* Cleanup on failure */
		BarWsQueueDestroy(&ctx->broadcastQueue);
		BarWsQueueDestroy(&ctx->commandQueue);
		pthread_mutex_destroy(&ctx->stateMutex);
		lws_context_destroy(ctx->context);
		free(ctx->connections);
		free(ctx);
		app->wsContext = NULL;
		return false;
	}
	
	fprintf(stderr, "WebSocket: Thread created successfully\n");
	
	return true;
}

/* Destroy WebSocket server */
void BarWebsocketDestroy(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return;
	}
	
	fprintf(stderr, "WebSocket: Stopping server...\n");
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	/* Signal thread to stop */
	ctx->threadRunning = false;
	
	/* Close queues to wake up any waiting operations */
	BarWsQueueClose(&ctx->broadcastQueue);
	BarWsQueueClose(&ctx->commandQueue);
	
	/* Cancel any ongoing lws_service() calls - safe in multi-threaded mode */
	if (ctx->context) {
		lws_cancel_service(ctx->context);
	}
	
	/* Wait for thread to finish */
	fprintf(stderr, "WebSocket: Waiting for thread to stop...\n");
	pthread_join(ctx->thread, NULL);
	fprintf(stderr, "WebSocket: Thread stopped\n");
	
	/* Now safe to cleanup (thread is dead) */
	if (ctx->context) {
		lws_context_destroy(ctx->context);
		ctx->context = NULL;
	}
	
	/* Cleanup queues and mutexes */
	BarWsQueueDestroy(&ctx->broadcastQueue);
	BarWsQueueDestroy(&ctx->commandQueue);
	pthread_mutex_destroy(&ctx->stateMutex);
	
	if (ctx->connections) {
		free(ctx->connections);
		ctx->connections = NULL;
	}
	
	free(ctx);
	app->wsContext = NULL;
	
	fprintf(stderr, "WebSocket: Server stopped\n");
}

/* Service WebSocket connections */
void BarWebsocketService(BarApp_t *app, int timeout_ms) {
	if (!app || !app->wsContext) {
		return;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	if (ctx->context) {
		lws_service(ctx->context, timeout_ms);
	}
}

/* Get current elapsed time */
unsigned int BarWebsocketGetElapsed(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return 0;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	if (!ctx->progress.isPlaying) {
		return 0;
	}
	
	time_t now = time(NULL);
	unsigned int elapsed = (unsigned int)(now - ctx->progress.songStartTime);
	
	/* Cap at duration */
	if (elapsed > ctx->progress.songDuration) {
		elapsed = ctx->progress.songDuration;
	}
	
	return elapsed;
}

/* Broadcast state to all connected clients */
void BarWebsocketBroadcastState(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return;
	}
	
	/* TODO: Implement state broadcasting */
	/* This will be implemented in socketio.c and ha_bridge.c */
}

/* Broadcast song start event */
void BarWebsocketBroadcastSongStart(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	/* Update progress tracking */
	pthread_mutex_lock(&ctx->stateMutex);
	ctx->progress.songStartTime = time(NULL);
	ctx->progress.isPlaying = true;
	ctx->progress.lastBroadcast = 0;
	
	/* Get song duration from player */
	if (app->player.songDuration > 0) {
		ctx->progress.songDuration = app->player.songDuration;
	}
	pthread_mutex_unlock(&ctx->stateMutex);
	
	/* Queue start event for WebSocket thread */
	/* For now, send without song data (will add song serialization later) */
	BarWsQueuePush(&ctx->broadcastQueue, MSG_TYPE_BROADCAST_START, NULL, 0);
	
	/* TEMPORARY: Also call Socket.IO directly until thread processing is complete */
	BarSocketIoEmitStart(app);
}

/* Broadcast song stop event */
void BarWebsocketBroadcastSongStop(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	pthread_mutex_lock(&ctx->stateMutex);
	ctx->progress.isPlaying = false;
	pthread_mutex_unlock(&ctx->stateMutex);
	
	/* Queue stop event for WebSocket thread */
	BarWsQueuePush(&ctx->broadcastQueue, MSG_TYPE_BROADCAST_STOP, NULL, 0);
	
	/* TEMPORARY: Also call Socket.IO directly until thread processing is complete */
	BarSocketIoEmitStop(app);
}

/* Broadcast volume change */
void BarWebsocketBroadcastVolume(BarApp_t *app, int volume) {
	if (!app || !app->wsContext) {
		return;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	/* Queue volume event for WebSocket thread */
	BarWsQueuePush(&ctx->broadcastQueue, MSG_TYPE_BROADCAST_VOLUME, &volume, sizeof(volume));
	
	/* TEMPORARY: Also call Socket.IO directly until thread processing is complete */
	BarSocketIoEmitVolume(app, volume);
}

/* Broadcast progress update */
void BarWebsocketBroadcastProgress(BarApp_t *app) {
	if (!app || !app->wsContext) {
		return;
	}
	
	BarWsContext_t *ctx = (BarWsContext_t *)app->wsContext;
	
	/* Lock to safely access progress state */
	pthread_mutex_lock(&ctx->stateMutex);
	
	if (!ctx->progress.isPlaying) {
		pthread_mutex_unlock(&ctx->stateMutex);
		return;
	}
	
	/* Calculate elapsed time */
	time_t now = time(NULL);
	time_t elapsed = now - ctx->progress.songStartTime;
	
	/* Only broadcast every second to avoid spam */
	if (elapsed == ctx->progress.lastBroadcast) {
		pthread_mutex_unlock(&ctx->stateMutex);
		return;
	}
	
	ctx->progress.lastBroadcast = elapsed;
	unsigned int duration = ctx->progress.songDuration;
	
	pthread_mutex_unlock(&ctx->stateMutex);
	
	/* Queue progress update for WebSocket thread */
	unsigned int times[2] = {(unsigned int)elapsed, duration};
	BarWsQueuePush(&ctx->broadcastQueue, MSG_TYPE_BROADCAST_PROGRESS, times, sizeof(times));
}

/* Broadcast message to all connected WebSocket clients */
static void BarWebsocketBroadcast(const char *message, size_t len) {
	/* TODO: Implement actual broadcasting to all connected clients
	 * For Phase 2.1, we log the message. Full implementation in Phase 4
	 * will iterate through all connected clients and queue messages.
	 */
	debugPrint(DEBUG_WEBSOCKET, "WebSocket: Broadcast (%zu bytes): %s\n", len, message);
}

/* Handle incoming WebSocket message */
void BarWebsocketHandleMessage(BarApp_t *app, const char *message,
                               size_t len, const char *protocol) {
	if (!app || !message || len == 0) {
		return;
	}
	
	/* Route to appropriate protocol handler */
	if (strcmp(protocol, "homeassistant") == 0) {
		/* TODO: Call BarHaBridgeHandleMessage(app, message); */
		debugPrint(DEBUG_WEBSOCKET, "WebSocket: HA message received (not yet implemented)\n");
	} else {
		/* Default to Socket.IO */
		BarSocketIoHandleMessage(app, message);
	}
}


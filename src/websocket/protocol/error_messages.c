/*
Copyright (c) 2024
	Kyle Hawes

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

#include "error_messages.h"
#include <string.h>

/* Translate generic error messages into user-friendly, action-specific messages */
const char* BarWsGetFriendlyErrorMessage(const char *operation, const char *originalError) {
	if (!originalError) {
		return "An unknown error occurred";
	}
	
	/* Handle "Call not allowed" - most common error for shared stations */
	if (strstr(originalError, "Call not allowed") != NULL || 
	    strstr(originalError, "not allowed") != NULL) {
		
		if (strcmp(operation, "station.rename") == 0) {
			return "Station cannot be renamed (shared stations cannot be modified)";
		} else if (strcmp(operation, "station.addMusic") == 0) {
			return "Music cannot be added (station may be shared or restricted)";
		} else if (strcmp(operation, "station.deleteSeed") == 0) {
			return "Seed cannot be deleted (station may be shared)";
		} else if (strcmp(operation, "station.deleteFeedback") == 0) {
			return "Feedback cannot be deleted (station may be shared)";
		} else if (strcmp(operation, "station.setStationMode") == 0) {
			return "Station mode cannot be changed (station may be restricted)";
		}
		return "Operation not allowed (station may be shared or restricted)";
	}
	
	/* Handle network errors */
	if (strstr(originalError, "Network error") != NULL ||
	    strstr(originalError, "network") != NULL ||
	    strstr(originalError, "Could not resolve host") != NULL ||
	    strstr(originalError, "Timeout") != NULL) {
		return "Unable to connect to Pandora (check your network connection)";
	}
	
	/* Handle authentication errors */
	if (strstr(originalError, "auth") != NULL ||
	    strstr(originalError, "login") != NULL ||
	    strstr(originalError, "Invalid") != NULL) {
		return "Authentication failed (session may have expired)";
	}
	
	/* Handle interrupted requests */
	if (strstr(originalError, "interrupted") != NULL ||
	    strstr(originalError, "Interrupted") != NULL) {
		return "Request was interrupted";
	}
	
	/* For other errors, create action-specific fallback messages */
	if (strcmp(operation, "station.rename") == 0) {
		return "Station cannot be renamed";
	} else if (strcmp(operation, "station.addMusic") == 0) {
		return "Music cannot be added to this station";
	} else if (strcmp(operation, "station.addGenre") == 0) {
		return "Genre station cannot be created";
	} else if (strcmp(operation, "station.addShared") == 0) {
		return "Shared station cannot be added";
	} else if (strcmp(operation, "station.getGenres") == 0) {
		return "Genre list cannot be loaded";
	} else if (strcmp(operation, "station.getStationModes") == 0) {
		return "Station modes cannot be loaded";
	} else if (strcmp(operation, "station.setStationMode") == 0) {
		return "Station mode cannot be changed";
	} else if (strcmp(operation, "station.getStationInfo") == 0) {
		return "Station information cannot be loaded";
	} else if (strcmp(operation, "station.deleteSeed") == 0) {
		return "Seed cannot be deleted";
	} else if (strcmp(operation, "station.deleteFeedback") == 0) {
		return "Feedback cannot be deleted";
	} else if (strcmp(operation, "music.search") == 0) {
		return "Music search failed";
	} else if (strcmp(operation, "station.setQuickMix") == 0) {
		return "QuickMix settings cannot be saved";
	} else if (strcmp(operation, "station.delete") == 0) {
		return "Station cannot be deleted";
	} else if (strcmp(operation, "station.createFrom") == 0) {
		return "Station cannot be created";
	}
	
	/* If we don't recognize the operation, return the original error */
	return originalError;
}


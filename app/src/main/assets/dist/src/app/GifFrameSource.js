/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * GifFrameSource decodes an animated image (for example an animated GIF) into
 * individual frames with the WebCodecs ImageDecoder, and advances the current
 * frame on each frame's own duration.
 */
// The frame duration to use when the decoder reports none, in microseconds.
const GIF_DEFAULT_FRAME_DURATION_MICROS = 100000;
// Upper bound on how many decoded frames are held in memory. Decoded frames are
// heavy image resources, so a gif with more frames than this keeps decoding its
// extra frames one at a time instead of caching them all.
const GIF_MAX_CACHED_FRAMES = 60;
// Downloaded image bytes shared across all GifFrameSource instances, keyed by
// the media URL.
const gifBytesCache = new Map();
class GifFrameSource {
    constructor(url, onFrame) {
        this._decoder = null;
        this._frameCount = 0;
        this._frameIndex = 0;
        this._currentFrame = null;
        this._currentFrameOwned = false;
        this._frameCache = new Map();
        this._timer = null;
        this._disposed = false;
        this._url = url;
        this._onFrame = onFrame;
    }
    static isSupported() {
        return typeof window.ImageDecoder !== 'undefined';
    }
    getCurrentFrame() {
        return this._currentFrame;
    }
    // Returns the raw image bytes for the source.
    // Media URL is downloaded over HTTP and its bytes are shared,
    // so a later source with the same URL reuses the same download.
    _fetchImageBytes(url) {
        const cached = gifBytesCache.get(url);
        if (cached)
            return cached;
        const pending = fetch(url).then((response) => {
            if (!response.ok)
                throw new Error('GifFrameSource: fetch failed with status ' + response.status);
            return response.arrayBuffer();
        });
        // Forget a failed download
        pending.catch(() => {
            if (gifBytesCache.get(url) === pending)
                gifBytesCache.delete(url);
        });
        gifBytesCache.set(url, pending);
        return pending;
    }
    // Downloads the image bytes, sets up the decoder, and starts the clock that
    // advances frames on their own durations.
    load() {
        if (!GifFrameSource.isSupported()) {
            app.console.error('GifFrameSource.load failed: ImageDecoder is not available');
            return;
        }
        this._fetchImageBytes(this._url)
            .then((buffer) => {
            if (this._disposed)
                return;
            this._initDecoder(buffer);
            this._scheduleNextFrame(GIF_DEFAULT_FRAME_DURATION_MICROS);
        })
            .catch((e) => {
            app.console.error('GifFrameSource.load failed: ' + e);
        });
    }
    // Creates the decoder from the image bytes and reads the frame count once
    // the decoder's track metadata is ready.
    _initDecoder(buffer) {
        if (this._disposed)
            return;
        this._decoder = new window.ImageDecoder({
            data: buffer,
            type: 'image/gif',
        });
        this._decoder.tracks.ready
            .then(() => {
            if (this._disposed)
                return;
            const track = this._decoder.tracks.selectedTrack;
            this._frameCount = track ? track.frameCount : 0;
        })
            .catch((e) => {
            app.console.error('GifFrameSource.load failed: ' + e);
        });
    }
    // Advances to the next frame and arms the timer that shows it. The document
    // tiles already show the first frame, so the animation can start on a timer
    // while the decoder's track metadata is still loading; until that metadata
    // is ready the frame count is zero, so the index stays on the first frame.
    _scheduleNextFrame(durationMicros) {
        if (this._frameCount)
            this._frameIndex = (this._frameIndex + 1) % this._frameCount;
        this._timer = app.timerRegistry.setTimeout('gifframe', () => this._decodeNextFrame(), Math.max(16, durationMicros / 1000));
    }
    // Shows the current frame, either from the cache or freshly decoded, then
    // schedules the next one after this frame's duration.
    _decodeNextFrame() {
        if (this._disposed || !this._decoder)
            return;
        // The decoder's track metadata may still be loading, so the frame count
        // is not known yet. Keep the timer running so the animation starts as
        // soon as the metadata is ready.
        if (!this._frameCount) {
            this._scheduleNextFrame(GIF_DEFAULT_FRAME_DURATION_MICROS);
            return;
        }
        const index = this._frameIndex % this._frameCount;
        const cached = this._frameCache.get(index);
        if (cached) {
            this._showFrame(cached, cached.duration || GIF_DEFAULT_FRAME_DURATION_MICROS, false);
            return;
        }
        this._decoder
            .decode({ frameIndex: index })
            .then((result) => {
            if (this._disposed) {
                result.image.close();
                return;
            }
            const durationMicros = result.image.duration || GIF_DEFAULT_FRAME_DURATION_MICROS;
            const cacheable = this._frameCache.size < GIF_MAX_CACHED_FRAMES;
            if (cacheable)
                this._frameCache.set(index, result.image);
            this._showFrame(result.image, durationMicros, !cacheable);
        })
            .catch((e) => {
            app.console.error('GifFrameSource.decode failed: ' + e);
        });
    }
    // Stores the frame for the host to draw, notifies the host, and schedules
    // the next frame.
    _showFrame(frame, durationMicros, owned) {
        if (this._currentFrame && this._currentFrameOwned)
            this._currentFrame.close();
        this._currentFrame = frame;
        this._currentFrameOwned = owned;
        this._onFrame();
        this._scheduleNextFrame(durationMicros);
    }
    dispose() {
        this._disposed = true;
        if (this._timer) {
            app.timerRegistry.clearTimeout(this._timer);
            this._timer = null;
        }
        if (this._currentFrame && this._currentFrameOwned) {
            this._currentFrame.close();
        }
        this._currentFrame = null;
        for (const frame of this._frameCache.values()) {
            frame.close();
        }
        this._frameCache.clear();
        if (this._decoder) {
            try {
                this._decoder.close();
            }
            catch (e) {
                // The decoder may already be closed.
            }
            this._decoder = null;
        }
    }
}

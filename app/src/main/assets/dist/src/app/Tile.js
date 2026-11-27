// @ts-strict-ignore
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
class Tile {
    /// How long a tile that has just been asked for waits before it is asked for again.
    static { this.requestWaitMs = 5000; }
    constructor(coords) {
        this.distanceFromView = 0; // distance to the center of the nearest visible area (0 = visible)
        this.image = null; // ImageBitmap ready to render
        this.rawDeltas = []; // deltas ready to decompress
        this.deltaCount = 0; // how many deltas on top of the keyframe
        this.updateCount = 0; // how many updates did we have
        this.loadCount = 0; // how many times did we get a new keyframe
        this.gcErrors = 0; // count freed keyframe in JS, but kept in wsd.
        this.missingContent = 0; // how many times rendered without content
        this.invalidateCount = 0; // how many invalidations touched this tile
        this.viewId = 0; // canonical view id
        this.wireId = 0; // monotonic timestamp for optimizing fetch
        this.invalidFrom = 0; // a wireId - for avoiding races on invalidation
        this.deltaId = 0; // monotonic id for delta updates
        this.lastPendingId = 0; // the id of the last delta requested to be decompressed
        this.decompressedId = 0; // the id of the last decompressed delta chunk in imgDataCache
        this.lastRendered = performance.timeOrigin;
        this.lastRequestTime = undefined; // when did we last do a tilecombine request.
        this.coords = coords;
    }
    hasContent() {
        return !!this.image || this.hasKeyframe();
    }
    needsFetch() {
        return this.invalidFrom >= this.wireId || !this.hasContent();
    }
    needsRehydration() {
        if (this.rawDeltas.length === 0)
            return false;
        const lastId = this.rawDeltas[this.rawDeltas.length - 1].id;
        return this.lastPendingId !== lastId;
    }
    hasKeyframe() {
        return !!this.rawDeltas.length;
    }
    isReady() {
        return this.decompressedId === this.lastPendingId;
    }
    /// Demand a whole tile back to the keyframe from coolwsd.
    forceKeyframe(wireId = 0) {
        this.wireId = wireId;
        this.invalidFrom = wireId;
        this.allowFastRequest();
    }
    /// The server has no newer content for this tile, so the tile is up to date again.
    clearInvalidation() {
        this.invalidFrom = 0;
    }
    /// Avoid continually re-requesting tiles for eg. preloading
    requestingTooFast(now) {
        const tooFast = this.lastRequestTime &&
            now.getTime() - this.lastRequestTime.getTime() < Tile.requestWaitMs;
        return tooFast;
    }
    updateLastRequest(now) {
        this.lastRequestTime = now;
    }
    /// Allow faster requests
    allowFastRequest() {
        this.updateLastRequest(undefined);
    }
    isReadyToDraw() {
        return !!this.image;
    }
}

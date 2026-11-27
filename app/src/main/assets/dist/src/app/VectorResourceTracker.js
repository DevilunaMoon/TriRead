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
/// Bookkeeping for one kind of content-addressed resource fetched on
/// demand: the loaded values, the ids in flight, the ids that turned
/// out unavailable, and which parts use which id. A part is named by its
/// cool.VectorPartGuid, so the same index in two modes is tracked apart.
class VectorResourceTracker {
    constructor(requestMessage) {
        this._cache = new Map();
        this._inFlight = new Set();
        this._unavailable = new Set();
        this._idToParts = new Map();
        this._requestMessage = requestMessage;
    }
    has(id) {
        return this._cache.has(id);
    }
    get(id) {
        return this._cache.get(id);
    }
    values() {
        return this._cache.values();
    }
    /// Remember that the part uses the ids.
    indexForPart(partId, ids) {
        for (const id of ids) {
            let parts = this._idToParts.get(id);
            if (!parts) {
                parts = new Set();
                this._idToParts.set(id, parts);
            }
            parts.add(partId);
        }
    }
    /// Parts that use the id.
    partsFor(id) {
        return this._idToParts.get(id);
    }
    /// Forget that the part uses anything, and drop the values nothing uses
    /// any more.
    releasePart(partId) {
        for (const [id, parts] of Array.from(this._idToParts.entries())) {
            if (!parts.delete(partId) || parts.size > 0)
                continue;
            this._idToParts.delete(id);
            this._cache.delete(id);
        }
    }
    /// Make the ids all that the part uses. The part lets go of the ids it no longer uses, and
    /// with dropUnused a value that nothing uses any more goes. An id the part uses before and
    /// after keeps its value.
    replacePart(partId, ids, dropUnused) {
        for (const [id, parts] of Array.from(this._idToParts.entries())) {
            if (ids.has(id) || !parts.delete(partId) || parts.size > 0)
                continue;
            this._idToParts.delete(id);
            if (dropUnused)
                this._cache.delete(id);
        }
        this.indexForPart(partId, ids);
    }
    /// Forget that the part uses anything, keeping the values.
    forgetPart(partId) {
        for (const [id, parts] of Array.from(this._idToParts.entries())) {
            if (parts.delete(partId) && parts.size === 0)
                this._idToParts.delete(id);
        }
    }
    /// Forget which parts use what, keeping the values.
    forgetAllParts() {
        this._idToParts.clear();
    }
    /// Request every id that is neither loaded, nor in flight, nor
    /// unavailable.
    requestMissing(ids) {
        for (const id of ids) {
            if (this._cache.has(id))
                continue;
            if (this._inFlight.has(id))
                continue;
            if (this._unavailable.has(id))
                continue;
            this._inFlight.add(id);
            app.socket.sendMessage(this._requestMessage(id));
        }
    }
    /// Store a loaded value and clear the in-flight mark.
    setLoaded(id, value) {
        this._cache.set(id, value);
        this._inFlight.delete(id);
    }
    /// Record an id no usable data could be obtained for, so it is not
    /// requested again.
    setUnavailable(id) {
        this._unavailable.add(id);
        this._inFlight.delete(id);
    }
    clearInFlight(id) {
        this._inFlight.delete(id);
    }
    /// Drop the loaded values, keeping which parts use which id. A dropped id is requested
    /// again as any missing one.
    dropValues() {
        this._cache.clear();
        this._inFlight.clear();
    }
    clear() {
        this._cache.clear();
        this._inFlight.clear();
        this._unavailable.clear();
        this._idToParts.clear();
    }
}

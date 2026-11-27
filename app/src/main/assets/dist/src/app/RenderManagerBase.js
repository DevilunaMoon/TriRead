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
class RenderManagerBase {
    constructor() {
        // Whether some of the document's content has arrived and can be painted.
        this.visualsReady = false;
        // Tasks to be executed once the first visuals are ready.
        this.afterVisualsReadyTasks = [];
    }
    // -- lifecycle / discovery --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    initialize() { }
    appendAfterVisualsReady(task) {
        // in case the visuals are already there -> do in next frame
        if (this.visualsReady)
            app.layoutingService.appendLayoutingTask(() => {
                task();
            });
        else
            this.afterVisualsReadyTasks.push(task);
    }
    /// Takes over the tasks that another manager still holds for its first
    /// visuals. They run once this manager has content to show.
    adoptAfterVisualsReadyTasks(previous) {
        for (const task of previous.afterVisualsReadyTasks)
            this.appendAfterVisualsReady(task);
        previous.afterVisualsReadyTasks = [];
    }
    /// Content to show arrived from outside the tiles. Run the waiting tasks.
    markVisualsReady() {
        if (!this.visualsReady)
            this.setVisualsReady();
    }
    setVisualsReady() {
        this.visualsReady = true;
        while (this.afterVisualsReadyTasks.length > 0) {
            const task = this.afterVisualsReadyTasks.shift();
            task();
        }
    }
    // -- rendering / drawing --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    updateOverlayMessages() { }
    // -- transactions (delta processing) --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    beginTransaction() { }
    endTransaction(callback = null) {
        if (callback)
            callback();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    sendProcessedResponse() { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onWorkerEndTransaction(_e) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onWorkerError(_e) { }
    // -- pre-fetching --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    resetPreFetching(_resetBorder) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    clearPreFetch() { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    initPreFetchAdjacentTiles() { }
    // -- memory / cache --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    pruneTiles() { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    reclaimGraphicsMemory() { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    discardAllCache() { }
    /// The tiles held.
    tileCount() {
        return 0;
    }
    /// Drop every tile held, keeping the rest of what the manager holds.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    discardTiles() { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    markThumbnailStale() { }
    // -- debug --
    // Tile state change subscribers. Static, so a subscriber survives the
    // instance being replaced when the document type becomes known. Nothing
    // subscribes unless the preload map debug overlay is on, so notifying
    // costs a length check.
    static { this.tileStateListeners = []; }
    onTileStateChanged(callback) {
        RenderManagerBase.tileStateListeners.push(callback);
    }
    offTileStateChanged(callback) {
        const index = RenderManagerBase.tileStateListeners.indexOf(callback);
        if (index >= 0)
            RenderManagerBase.tileStateListeners.splice(index, 1);
    }
    /// Tell subscribers that some tile's state changed: created, destroyed,
    /// invalidated, requested, or given new content.
    notifyTileStateChanged() {
        for (const callback of RenderManagerBase.tileStateListeners)
            callback();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setDebugDeltas(_state) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    refreshTilesInBackground() { }
    // -- tile lookup --
    get(_coords) {
        return null;
    }
    getTiles() {
        return new Map();
    }
    isValidTile(_coords) {
        return false;
    }
    // -- geometry --
    pxBoundsToTileRange(_bounds) {
        // An empty range, with max below min, so that a range loop that
        // counts up from min to max runs zero times.
        return new cool.Bounds(new cool.Point(0, 0), new cool.Point(-1, -1));
    }
    expandTileRange(range) {
        return range;
    }
    predictTilesToSlurp() {
        return 0;
    }
    // -- invalidation --
    overlapInvalidatedRectangleWithView(_part, _mode, _wireId, _invalidatedRectangle, _textMsg) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    invalidateTile(_key, _wireId) { }
    // -- update / fetch --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    update(_center = null, _zoom = null) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    updateOnChangePart() { }
    updateFileBasedView(_checkOnly = false, _zoomFrameBounds = null, _forZoom = null) {
        return [];
    }
    checkRequestTiles(_currentCoordList, _sendTileCombine = true) {
        return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    requestVisibleTiles(_currentCoordList) { }
    // -- message handling --
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onTileMsg(_textMsg, _img) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onTileGoneMsg(_textMsg) { }
    // -- expiry / touch --
    getExpiryFactor(_tile) {
        return 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    touchImage(_tile) { }
    /// Whether the client holds the drawing objects and selects, hit tests
    /// and moves them itself.
    drawsFromObjects() {
        return this.isVectorRendering();
    }
    /// The message with object positions in the engine's placement.
    toEngine(message) {
        return message;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    refreshTheme() { }
    // -- redraw --
    redraw() {
        return this;
    }
}

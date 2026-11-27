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
/// Static facade exposing the RenderManager API as static methods.
class RenderManager {
    /// True when the document renders from vector primitives: an Impress or
    /// Draw document with the vector rendering option enabled.
    static wantsVector(docType) {
        return ((docType === 'presentation' || docType === 'drawing') &&
            cool.VectorRenderingConfig.isEnabled());
    }
    /// Pick the manager for the document type, replacing the instance when
    /// an earlier one is of the wrong kind.
    static makeInstance(docType) {
        const wantVector = RenderManager.wantsVector(docType);
        const haveVector = RenderManager._instance instanceof VectorManager;
        if (!RenderManager._instance || wantVector !== haveVector) {
            // The replaced manager releases everything it holds, such as
            // the font faces it registered on the document.
            const previous = RenderManager._instance;
            if (previous)
                previous.discardAllCache();
            RenderManager._instance = wantVector
                ? new VectorManager()
                : new BitmapTileManager();
            // The tasks that wait for the first visuals move to the new
            // manager. The provisional manager made before the document type
            // is known shows no content when the document draws from vectors.
            if (previous)
                RenderManager._instance.adoptAfterVisualsReadyTasks(previous);
        }
        return RenderManager._instance;
    }
    static ensureInstance() {
        // Provisional default before the document type is known.
        if (!RenderManager._instance)
            RenderManager._instance = new BitmapTileManager();
        return RenderManager._instance;
    }
    static get tileSize() {
        return window.tileSize;
    }
    static initialize(docType) {
        RenderManager.makeInstance(docType).initialize();
    }
    /// Pick the manager again, for when the answer to wantsVector has changed while a document is
    /// open. A manager of the wrong kind is replaced and the new one initialized.
    static reinitialize(docType) {
        const previous = RenderManager._instance;
        const instance = RenderManager.makeInstance(docType);
        if (instance !== previous)
            instance.initialize();
    }
    static appendAfterVisualsReady(task) {
        RenderManager.ensureInstance().appendAfterVisualsReady(task);
    }
    static markThumbnailStale() {
        RenderManager.ensureInstance().markThumbnailStale();
    }
    static markVisualsReady() {
        RenderManager.ensureInstance().markVisualsReady();
    }
    static updateOverlayMessages() {
        RenderManager.ensureInstance().updateOverlayMessages();
    }
    static getExpiryFactor(tile) {
        return RenderManager.ensureInstance().getExpiryFactor(tile);
    }
    static beginTransaction() {
        RenderManager.ensureInstance().beginTransaction();
    }
    static endTransaction(callback = null) {
        RenderManager.ensureInstance().endTransaction(callback);
    }
    static refreshTilesInBackground() {
        RenderManager.ensureInstance().refreshTilesInBackground();
    }
    static setDebugDeltas(state) {
        RenderManager.ensureInstance().setDebugDeltas(state);
    }
    static onTileStateChanged(callback) {
        RenderManager.ensureInstance().onTileStateChanged(callback);
    }
    static offTileStateChanged(callback) {
        RenderManager.ensureInstance().offTileStateChanged(callback);
    }
    static get(coords) {
        return RenderManager.ensureInstance().get(coords);
    }
    static getTiles() {
        return RenderManager.ensureInstance().getTiles();
    }
    static overlapInvalidatedRectangleWithView(part, mode, wireId, invalidatedRectangle, textMsg) {
        RenderManager.ensureInstance().overlapInvalidatedRectangleWithView(part, mode, wireId, invalidatedRectangle, textMsg);
    }
    static resetPreFetching(resetBorder) {
        RenderManager.ensureInstance().resetPreFetching(resetBorder);
    }
    static clearPreFetch() {
        RenderManager.ensureInstance().clearPreFetch();
    }
    static initPreFetchAdjacentTiles() {
        RenderManager.ensureInstance().initPreFetchAdjacentTiles();
    }
    static sendProcessedResponse() {
        RenderManager.ensureInstance().sendProcessedResponse();
    }
    static onTileMsg(textMsg, img) {
        RenderManager.ensureInstance().onTileMsg(textMsg, img);
    }
    static onTileGoneMsg(textMsg) {
        RenderManager.ensureInstance().onTileGoneMsg(textMsg);
    }
    static predictTilesToSlurp() {
        return RenderManager.ensureInstance().predictTilesToSlurp();
    }
    static pruneTiles() {
        RenderManager.ensureInstance().pruneTiles();
    }
    static reclaimGraphicsMemory() {
        RenderManager.ensureInstance().reclaimGraphicsMemory();
    }
    static discardAllCache() {
        RenderManager.ensureInstance().discardAllCache();
    }
    static discardTiles() {
        RenderManager.ensureInstance().discardTiles();
    }
    static tileCount() {
        return RenderManager.ensureInstance().tileCount();
    }
    static isValidTile(coords) {
        return RenderManager.ensureInstance().isValidTile(coords);
    }
    static redraw() {
        return RenderManager.ensureInstance().redraw();
    }
    static update(zoom = null) {
        RenderManager.ensureInstance().update(zoom);
    }
    static onWorkerEndTransaction(e) {
        RenderManager.ensureInstance().onWorkerEndTransaction(e);
    }
    static onWorkerError(e) {
        RenderManager.ensureInstance().onWorkerError(e);
    }
    static updateOnChangePart() {
        RenderManager.ensureInstance().updateOnChangePart();
    }
    static expandTileRange(range) {
        return RenderManager.ensureInstance().expandTileRange(range);
    }
    static pxBoundsToTileRange(bounds) {
        return RenderManager.ensureInstance().pxBoundsToTileRange(bounds);
    }
    static checkRequestTiles(currentCoordList, sendTileCombine = true) {
        return RenderManager.ensureInstance().checkRequestTiles(currentCoordList, sendTileCombine);
    }
    static requestVisibleTiles(currentCoordList) {
        RenderManager.ensureInstance().requestVisibleTiles(currentCoordList);
    }
    static updateFileBasedView(checkOnly = false, zoomFrameBounds = null, forZoom = null) {
        return RenderManager.ensureInstance().updateFileBasedView(checkOnly, zoomFrameBounds, forZoom);
    }
    static invalidateTile(key, wireId) {
        RenderManager.ensureInstance().invalidateTile(key, wireId);
    }
    static touchImage(tile) {
        RenderManager.ensureInstance().touchImage(tile);
    }
    // vector rendering specific
    static isVectorRendering() {
        return RenderManager.ensureInstance().isVectorRendering();
    }
    static drawsFromObjects() {
        return RenderManager.ensureInstance().drawsFromObjects();
    }
    static toEngine(message) {
        return RenderManager.ensureInstance().toEngine(message);
    }
    static predictTextInsert(text) {
        return RenderManager.ensureInstance().predictTextInsert(text);
    }
    static predictTextDelete(before, after) {
        return RenderManager.ensureInstance().predictTextDelete(before, after);
    }
    static keepPredictedCaret(update) {
        return RenderManager.ensureInstance().keepPredictedCaret(update);
    }
    static canPredictAtCaret() {
        return RenderManager.ensureInstance().canPredictAtCaret();
    }
    static moveCaretByCharacter(step, extend = false) {
        return RenderManager.ensureInstance().moveCaretByCharacter(step, extend);
    }
    static moveCaretByWord(step, extend = false) {
        return RenderManager.ensureInstance().moveCaretByWord(step, extend);
    }
    static moveCaretByLine(step, extend = false) {
        return RenderManager.ensureInstance().moveCaretByLine(step, extend);
    }
    static startTextDrag(x, y, hitId) {
        return RenderManager.ensureInstance().startTextDrag(x, y, hitId);
    }
    static dragTextTo(x, y) {
        RenderManager.ensureInstance().dragTextTo(x, y);
    }
    static endTextDrag() {
        RenderManager.ensureInstance().endTextDrag();
    }
    static placeCaretAt(x, y, hitId) {
        return RenderManager.ensureInstance().placeCaretAt(x, y, hitId);
    }
    static selectWordAt(x, y, hitId) {
        return RenderManager.ensureInstance().selectWordAt(x, y, hitId);
    }
    static selectParagraphAt(x, y, hitId) {
        return RenderManager.ensureInstance().selectParagraphAt(x, y, hitId);
    }
    static requestThumbnail(id, part, mode, maxWidth, maxHeight) {
        RenderManager.ensureInstance().requestThumbnail(id, part, mode, maxWidth, maxHeight);
    }
    static requestPart(part, mode) {
        return RenderManager.ensureInstance().requestPart(part, mode);
    }
    static partIdAt(part, mode) {
        return RenderManager.ensureInstance().partIdAt(part, mode);
    }
    static renderInto(context, data, options) {
        RenderManager.ensureInstance().renderInto(context, data, options);
    }
    static renderObjectsWith(context, data, objectIds, matrix) {
        RenderManager.ensureInstance().renderObjectsWith(context, data, objectIds, matrix);
    }
    static renderPrimitives(context, data, primitives) {
        RenderManager.ensureInstance().renderPrimitives(context, data, primitives);
    }
    static renderObjectParagraph(context, data, objectId, paragraph, colorOverride, textOverride) {
        RenderManager.ensureInstance().renderObjectParagraph(context, data, objectId, paragraph, colorOverride, textOverride);
    }
    static renderPlaceholderAids(context, data) {
        RenderManager.ensureInstance().renderPlaceholderAids(context, data);
    }
    static textColorOf(data, primitive) {
        return RenderManager.ensureInstance().textColorOf(data, primitive);
    }
    static drawnElsewhere(objectIds) {
        RenderManager.ensureInstance().drawnElsewhere(objectIds);
    }
    static drawnElsewhereVersion() {
        return RenderManager.ensureInstance().drawnElsewhereVersion();
    }
    static isPartDrawable(part, mode) {
        return RenderManager.ensureInstance().isPartDrawable(part, mode);
    }
    static requestPartById(partId, mode) {
        return RenderManager.ensureInstance().requestPartById(partId, mode);
    }
    static isPartDrawableById(partId, mode) {
        return RenderManager.ensureInstance().isPartDrawableById(partId, mode);
    }
    static isLayerVisible(layer) {
        return RenderManager.ensureInstance().isLayerVisible(layer);
    }
    static onVectorChanged(callback) {
        RenderManager.ensureInstance().onVectorChanged(callback);
    }
    static offVectorChanged(callback) {
        RenderManager.ensureInstance().offVectorChanged(callback);
    }
    /// Says that the objects the client holds changed here rather than at the engine.
    static changedHere() {
        RenderManager.ensureInstance().changedHere();
    }
    static handleVectorPrimitivesResponse(values) {
        RenderManager.ensureInstance().handleVectorPrimitivesResponse(values);
    }
    static handleVectorRenderingGraphicsResponse(values) {
        RenderManager.ensureInstance().handleVectorRenderingGraphicsResponse(values);
    }
    static handleVectorRenderingFontResponse(values) {
        RenderManager.ensureInstance().handleVectorRenderingFontResponse(values);
    }
    static handleVectorPrimitivesDelta(values) {
        RenderManager.ensureInstance().handleVectorPrimitivesDelta(values);
    }
    static partListChanged() {
        RenderManager.ensureInstance().partListChanged();
    }
    static revalidateCachedParts() {
        RenderManager.ensureInstance().revalidateCachedParts();
    }
    static forgetRequestsInFlight() {
        RenderManager.ensureInstance().forgetRequestsInFlight();
    }
    static clearCachedPart(partId) {
        RenderManager.ensureInstance().clearCachedPart(partId);
    }
    static clearAllParts() {
        RenderManager.ensureInstance().clearAllParts();
    }
    static refreshTheme() {
        RenderManager.ensureInstance().refreshTheme();
    }
}
window.RenderManager = RenderManager;

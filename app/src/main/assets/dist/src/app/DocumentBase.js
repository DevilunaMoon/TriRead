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
class DocumentBase {
    constructor() {
        this.type = 'DocumentBase';
        this.mouseControl = null;
        this._activeModes = [0];
        this.views = new Map();
        this.activeViewSelectionColor = 'lightblue'; // Overwritten in constructor.
        this.partHasComments = undefined;
        if (!app.activeDocument)
            app.activeDocument = this;
        if (app.map._docLayer._docType === 'text') {
            this._activeLayout = new ViewLayoutWriter();
        }
        else if (app.file.fileBasedView) {
            this._activeLayout = new ViewLayoutFileBased();
        }
        else if (app.map._docLayer._docType === 'spreadsheet') {
            this._activeLayout = new ViewLayoutCalc();
        }
        else {
            this._activeLayout = ViewLayoutVector.forAPresentation();
        }
        this._fileSize = new cool.SimplePoint(0, 0);
        this.tableMiddleware = new TableMiddleware();
        this.tableMiddleware.setupTableOverlay();
        if (app.map._docLayer._docType === 'presentation')
            this.selectionMiddleware = new ImpressSelectionMiddleware();
        else
            this.selectionMiddleware = null;
        this.addSections();
        this.activeViewID = 0;
        this.activeView = new DocumentViewBase(this.activeViewID);
        const dummyDiv = document.createElement('div');
        dummyDiv.className = 'selections-data';
        document.body.appendChild(dummyDiv);
        this.activeViewSelectionColor =
            getComputedStyle(dummyDiv).getPropertyValue('background-color');
        this.activeView.setColor(this.activeViewSelectionColor);
        dummyDiv.remove();
    }
    get activeLayout() {
        return this._activeLayout;
    }
    // Setting a new layout releases the previous one.
    // The new layout is built before this runs,
    // and dispose removes only the subscriptions that were made with the
    // replaced layout as the context, so the new one's stay in place.
    set activeLayout(newLayout) {
        if (this._activeLayout === newLayout)
            return;
        this._activeLayout.dispose();
        this._activeLayout = newLayout;
        newLayout.setStartYPosition();
    }
    // Swap the layout at runtime (e.g. mobile Impress toggling fileBasedView
    // when switching between read-only and edit).
    swapLayout(newLayout) {
        this.activeLayout = newLayout;
        app.sectionContainer.onNewDocumentTopLeft();
        app.sectionContainer.requestReDraw();
    }
    setActiveViewID(activeViewID) {
        if (this.activeViewID !== activeViewID) {
            this.activeViewID = activeViewID;
            this.activeView.clearTextSelection();
            // Remove the old active view's section before creating a new one.
            app.sectionContainer.removeSection(this.activeView.selectionSection.name);
            this.activeView = new DocumentViewBase(this.activeViewID);
            this.activeView.setColor(this.activeViewSelectionColor);
        }
    }
    addSections() {
        this.mouseControl = new MouseControl(app.CSections.MouseControl.name);
        if (app.sectionContainer.doesSectionExist(this.mouseControl.name))
            app.sectionContainer.removeSection(this.mouseControl.name);
        app.sectionContainer.addSection(this.mouseControl);
        if (app.map._docLayer._docType === 'text' &&
            app.map.uiManager?.isRulerVisible()) {
            app.sectionContainer.addSection(new cool.RulerSpacerSection());
        }
        // Owns zooming for the document layouts, replacing the map's
        // zoomIn/zoomOut/setZoom. Exposed as app.zoomControl, which drives an
        // animated zoom directly.
        const zoomControl = new ZoomControl();
        app.sectionContainer.addSection(zoomControl);
        app.zoomControl = zoomControl;
        // Layout spacers that let the tiles (document-anchor) section shrink to
        // the content size when the document is smaller than the frame. Only
        // spreadsheets get them, because only Calc sizes them, and even a
        // zero-sized spacer takes a pixel from a tiles section anchored at the
        // canvas edge.
        if (app.map._docLayer._docType === 'spreadsheet') {
            app.sectionContainer.addSection(new cool.SpacerSection('right'));
            app.sectionContainer.addSection(new cool.SpacerSection('bottom'));
        }
    }
    get fileSize() {
        return this._fileSize;
    }
    set fileSize(value) {
        this._fileSize = value;
    }
    removeView(viewID) {
        if (this.views.has(viewID)) {
            app.sectionContainer.removeSection(this.views.get(viewID).selectionSection.name);
            this.views.delete(viewID);
        }
    }
    // This shouldn't create views if not found. But it will happen when we use only this class for views.
    getView(viewID) {
        if (this.views.has(viewID))
            return this.views.get(viewID);
        else {
            this.views.set(viewID, new DocumentViewBase(viewID));
            return this.views.get(viewID);
        }
    }
    set activeModes(modes) {
        this._activeModes = modes.slice();
    }
    get activeModes() {
        return this._activeModes.slice();
    }
    isModeActive(mode) {
        return this._activeModes.includes(mode);
    }
    // Coordinate/scale math (pure InternPointUtil, no map DOM). The zoom defaults
    // to the current zoom; callers pass an explicit zoom for the zoom-animation
    // frames. Moved off the leaflet map so document code does not depend on it.
    project(intern, zoom) {
        const z = zoom === undefined ? app.map.getZoom() : zoom;
        const projectedPoint = InternPointUtil.internToPoint(InternPointUtil.flexConstruct(intern), z);
        return new cool.Point(app.util.round(projectedPoint.x, 1e-6), app.util.round(projectedPoint.y, 1e-6));
    }
    unproject(point, zoom) {
        const z = zoom === undefined ? app.map.getZoom() : zoom;
        return InternPointUtil.pointToIntern(new cool.Point(point.x, point.y), z);
    }
    rescale(point, oldZoom, newZoom) {
        const o = oldZoom === undefined ? app.map.getZoom() : oldZoom;
        const n = newZoom === undefined ? app.map.getZoom() : newZoom;
        return InternPointUtil.rescale(point, o, n);
    }
    // Ratio between two zoom levels (pure scale math). fromZoom defaults to the
    // current zoom.
    getZoomScale(toZoom, fromZoom) {
        const from = fromZoom === undefined ? app.map.getZoom() : fromZoom;
        return InternPointUtil.scale(toZoom) / InternPointUtil.scale(from);
    }
    // Inverse of getZoomScale: the zoom level that produces the given scale
    // relative to fromZoom (defaults to the current zoom).
    getScaleZoom(scale, fromZoom) {
        const from = fromZoom === undefined ? app.map.getZoom() : fromZoom;
        return from + Math.log(scale) / Math.log(InternPointUtil.SCALE);
    }
    // The current zoom level as a UI percentage (100 = default zoom).
    getZoomPercent() {
        switch (app.map.getZoom()) {
            case 1:
                return 20;
            case 2:
                return 25;
            case 3:
                return 30;
            case 4:
                return 35;
            case 5:
                return 40;
            case 6:
                return 50;
            case 7:
                return 60;
            case 8:
                return 70;
            case 9:
                return 85;
            case 10:
                return 100;
            case 11:
                return 120;
            case 12:
                return 150;
            case 13:
                return 170;
            case 14:
                return 200;
            case 15:
                return 235;
            case 16:
                return 280;
            case 17:
                return 335;
            case 18:
                return 400;
            // Zoom is always one of the integer levels above; treat anything else
            // as the default 100%.
            default:
                return 100;
        }
    }
    // Zoom level for a given UI percentage (inverse of getZoomPercent's table).
    getZoomIndex(zoomPercent) {
        switch (zoomPercent) {
            case 20:
                return 1;
            case 25:
                return 2;
            case 30:
                return 3;
            case 35:
                return 4;
            case 40:
                return 5;
            case 50:
                return 6;
            case 60:
                return 7;
            case 70:
                return 8;
            case 85:
                return 9;
            case 100:
                return 10;
            case 120:
                return 11;
            case 150:
                return 12;
            case 170:
                return 13;
            case 200:
                return 14;
            case 235:
                return 15;
            case 280:
                return 16;
            case 335:
                return 17;
            case 400:
                return 18;
            default:
                return 10; // TODO: calculate the nearest index
        }
    }
}

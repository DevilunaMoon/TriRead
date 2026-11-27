/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
class CellSelectionHandle extends CanvasSectionObject {
    constructor(name, isStart) {
        super(name);
        this.showSection = false;
        this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
        this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder;
        this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
        this.documentObject = true;
        // Text span of the formula reference under the handle, or null on the cell selection.
        this.textSelection = null;
        // True on the reference nearest to the formula selection.
        this.active = false;
        this.isStart = isStart;
        this.sectionProperties.circleRadius = 10 * app.dpiScale;
        this.size = [this.sectionProperties.circleRadius * 2, this.sectionProperties.circleRadius * 2];
    }
    onDragEnd(point) {
        app.map.refocus();
        app.map.fire('scrollvelocity', { vx: 0, vy: 0 });
        point.pX += this.position[0];
        point.pY += this.position[1];
        this.sharedOnDragAndEnd(point);
        CellSelectionMarkers.update();
        app.map.scrollingIsHandled = false;
    }
    sharedOnDragAndEnd(point) {
        const type = this.isStart ? 'start' : 'end';
        app.map._docLayer._postSelectTextEvent(type, point.x, point.y);
    }
    onDrag(point) {
        // The pointer's position on screen, relative to the canvas. The point is shifted into
        // document coordinates afterwards.
        const viewportPoint = cool.SimplePoint.fromCorePixels([this.myTopLeft[0] + point.pX, this.myTopLeft[1] + point.pY]);
        app.map.fire('handleautoscroll', { pos: { x: viewportPoint.cX, y: viewportPoint.cY }, map: app.map });
        point.pX += this.position[0];
        point.pY += this.position[1];
        this.sharedOnDragAndEnd(point);
    }
    onDraw() {
        this.context.strokeStyle = window.prefs.getBoolean('darkTheme') ? 'white' : 'black';
        this.context.lineWidth = 2;
        this.context.beginPath();
        this.context.arc(this.sectionProperties.circleRadius, this.sectionProperties.circleRadius, this.sectionProperties.circleRadius, 0, 2 * Math.PI);
        this.context.stroke();
    }
    onMouseMove(point, dragDistance, e) {
        e.stopPropagation();
        if (this.containerObject.isDraggingSomething()) {
            app.map.scrollingIsHandled = true;
            this.stopPropagating();
            this.onDrag(point);
        }
    }
    onMouseDown(point, e) {
        e.stopPropagation();
        this.stopPropagating();
        // The engine drags the active reference, so select any other one first.
        if (this.textSelection !== null && !this.active && app.map.formulabar)
            app.map.formulabar.selectText(this.textSelection);
    }
    onMouseUp(point, e) {
        e.stopPropagation();
        if (this.containerObject.isDraggingSomething()) {
            this.stopPropagating();
            this.onDragEnd(point);
        }
    }
}

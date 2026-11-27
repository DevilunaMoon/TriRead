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
/* See CanvasSectionContainer.ts for explanations. */
class SelectionRectangle extends CanvasSectionObject {
    // Same gesture is used to move the screen on touch devices. So we don't draw a selection rectangle on touch events.
    constructor() {
        super(app.CSections.SelectionRectangle.name);
        this.processingOrder = app.CSections.SelectionRectangle.processingOrder;
        this.drawingOrder = app.CSections.SelectionRectangle.drawingOrder;
        this.zIndex = app.CSections.SelectionRectangle.zIndex;
        this.documentObject = true;
        this.boundToSection = app.CSections.Tiles.name;
        this.size = app.sectionContainer.getDocumentAnchorSection().size;
        this.sectionProperties.positionOnMouseDown = null;
        this.sectionProperties.selectionSize = null;
        this.sectionProperties.active = true;
    }
    setActive(active) {
        this.sectionProperties.active = active;
    }
    onMouseMove(point, dragDistance, e) {
        if (e.type === 'touchmove')
            return;
        if (this.containerObject.isDraggingSomething() &&
            this.containerObject.targetSection === this.name &&
            this.sectionProperties.positionOnMouseDown) {
            this.sectionProperties.selectionSize = [
                point.pX - this.sectionProperties.positionOnMouseDown.pX,
                point.pY - this.sectionProperties.positionOnMouseDown.pY,
            ];
        }
    }
    onMouseUp(point, e) {
        if (e.type === 'touchend')
            return;
        this.sectionProperties.positionOnMouseDown = null;
        this.sectionProperties.selectionSize = null;
    }
    onMouseDown(point, e) {
        if (e.type === 'touchstart')
            return;
        this.sectionProperties.positionOnMouseDown = point;
    }
    onNewDocumentTopLeft() {
        this.setPosition(app.activeDocument.activeLayout.viewedRectangle.pX1, app.activeDocument.activeLayout.viewedRectangle.pY1);
    }
    onDraw(frameCount, elapsedTime) {
        if (this.sectionProperties.positionOnMouseDown &&
            this.sectionProperties.selectionSize &&
            this.sectionProperties.active) {
            this.context.beginPath();
            this.context.strokeStyle = 'dark grey';
            this.context.setLineDash([3, 3]);
            this.context.strokeRect(this.sectionProperties.positionOnMouseDown.pX, this.sectionProperties.positionOnMouseDown.pY, this.sectionProperties.selectionSize[0], this.sectionProperties.selectionSize[1]);
            this.context.setLineDash([]);
            this.context.closePath();
        }
    }
}

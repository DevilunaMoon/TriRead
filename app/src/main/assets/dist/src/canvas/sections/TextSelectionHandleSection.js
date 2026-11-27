// @ts-strict-ignore
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
class TextSelectionHandle extends HTMLObjectSection {
    constructor(sectionName, objectWidth, objectHeight, documentPosition, extraClass = "", showSection = false) {
        super(sectionName, objectWidth, objectHeight, documentPosition, extraClass, showSection);
        this._showSection = true; // Store the internal show/hide section through forced non-touchscreen hides...
    }
    onDrag(point) {
        const candidateX = Math.round((this.myTopLeft[0] + point.pX) / app.dpiScale);
        const candidateY = Math.round((this.myTopLeft[1] + point.pY) / app.dpiScale);
        this.sectionProperties.objectDiv.style.left = candidateX + 'px';
        this.sectionProperties.objectDiv.style.top = candidateY + 'px';
        app.map.fire('handleautoscroll', { pos: { x: candidateX, y: candidateY }, map: app.map });
    }
    setShowSection(show) {
        this._showSection = show;
        if (!window.touch.currentlyUsingTouchscreen()) {
            super.setShowSection(false);
        }
        else {
            super.setShowSection(this._showSection);
        }
    }
    setOpacity(value) {
        this.getHTMLObject().style.opacity = value;
    }
    onDragEnd(point) {
        let x = this.position[0] + point.pX;
        const y = this.position[1] + point.pY;
        this.setPosition(x, y);
        app.map.fire('scrollvelocity', { vx: 0, vy: 0 });
        const type = this.name === 'selection_start_handle' ? 'start' : 'end';
        if (type === 'start')
            x += 30 / app.dpiScale;
        if (!app.map._docLayer.isCalcRTL()) {
            app.map._docLayer._postSelectTextEvent(type, Math.round(x * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
        }
        else {
            const referenceX = app.activeDocument.activeLayout.viewedRectangle.pX1 + (app.activeDocument.activeLayout.viewedRectangle.pX2 - this.position[0]);
            app.map._docLayer._postSelectTextEvent(type, Math.round(referenceX * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
        }
    }
    onMouseMove(point, dragDistance, e) {
        e.stopPropagation();
        if (this.containerObject.isDraggingSomething()) {
            this.stopPropagating();
            this.onDrag(point);
        }
    }
    onDocumentObjectVisibilityChange() {
        if (this.showSection && this.isVisible)
            this.sectionProperties.objectDiv.style.display = '';
        else
            this.sectionProperties.objectDiv.style.display = 'none';
    }
    onClick(point, e) {
        e.stopPropagation();
        this.stopPropagating();
    }
    onMouseDown(point, e) {
        e.stopPropagation();
        this.stopPropagating();
    }
    onMouseUp(point, e) {
        e.stopPropagation();
        if (this.containerObject.isDraggingSomething()) {
            this.stopPropagating();
            this.onDragEnd(point);
        }
    }
}

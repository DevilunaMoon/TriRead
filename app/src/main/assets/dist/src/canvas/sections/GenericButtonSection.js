/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class GenericButtonSection extends HTMLObjectSection {
    constructor(sectionName, width, height, extraClass, unoCommand) {
        super(sectionName, width, height, new cool.SimplePoint(0, 0), extraClass, true);
        this._lastZoom = 0;
        this._unoCommand = '';
        this._unoCommand = unoCommand;
    }
    onMouseEnter(point, e) {
        this.getHTMLObject()?.classList.add('hovered');
    }
    onMouseLeave(point, e) {
        this.getHTMLObject()?.classList.remove('hovered');
    }
    onMouseDown(point, e) {
        this.stopEvents(e);
    }
    onMouseUp(point, e) {
        this.stopEvents(e);
    }
    stopEvents(e) {
        this.stopPropagating();
        // We shouldn't need below 2 when we remove map element.
        e.preventDefault();
        e.stopImmediatePropagation();
    }
    onClick(point, e) {
        app.socket.sendMessage(this._unoCommand);
    }
    calculatePositionPixel() {
        // if not overloaded return default top-left position
        return [0, 0];
    }
    updatePosition() {
        const origZoom = app.map.getZoom();
        // Position goes wrong when zoom change so update it when zoom changed.
        if (this._lastZoom != origZoom) {
            this._lastZoom = origZoom;
            const newPosition = this.calculatePositionPixel();
            this.setPosition(newPosition[0], newPosition[1]);
        }
    }
    // catch zoom, and scroll events ..
    adjustHTMLObjectPosition() {
        this.updatePosition();
        super.adjustHTMLObjectPosition();
    }
    forceNextReposition() {
        this._lastZoom = 0;
    }
}

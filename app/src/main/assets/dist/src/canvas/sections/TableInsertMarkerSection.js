/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class TableInsertMarkerSection extends HTMLObjectSection {
    static { this.namePrefix = 'TableInsertMarker_'; }
    constructor(type, documentPosition) {
        super(TableInsertMarkerSection.namePrefix + type, 0, 0, documentPosition, 'table-add-col-row-marker', true);
        this.sectionProperties.markerType = type;
        this.sectionProperties.mouseEntered = false;
        const div = this.getHTMLObject();
        div.classList.add('table-add-col-row-marker');
    }
    onMouseEnter() {
        this.sectionProperties.mouseEntered = true;
        this.getHTMLObject()?.classList.add('hovered');
        this.context.canvas.style.cursor = 'pointer';
    }
    onMouseLeave() {
        this.sectionProperties.mouseEntered = false;
        this.getHTMLObject()?.classList.remove('hovered');
    }
    onClick(point, e) {
        if (this.sectionProperties.markerType === 'column') {
            app.socket.sendMessage('uno .uno:InsertColumnsAfter');
        }
        else {
            app.socket.sendMessage('uno .uno:InsertRowsAfter');
        }
    }
    getMarkerType() {
        return this.sectionProperties.markerType;
    }
    setMarkerSize(width, height) {
        this.size = [width * app.dpiScale, height * app.dpiScale];
        const container = this.getHTMLObject();
        if (container) {
            container.style.width = `${width}px`;
            container.style.height = `${height}px`;
        }
    }
}

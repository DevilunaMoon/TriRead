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
/*
    This file is Calc only. This adds a header section for grouped columns and rows in Calc.
    When user uses row grouping and column grouping at the same time, there occurs a space at the crossing point of the row group and column group sections.
    This sections fills that gap.

    This class is an extended version of "CanvasSectionObject".
*/
var cool;
(function (cool) {
    class CornerGroup extends cool.GroupBase {
        constructor() {
            super(app.CSections.CornerGroup.name);
            this.anchor = ['top', 'left'];
            this.processingOrder = app.CSections.CornerGroup.processingOrder;
            this.drawingOrder = app.CSections.CornerGroup.drawingOrder;
            this.zIndex = app.CSections.CornerGroup.zIndex;
            this.sectionProperties = { cursor: 'pointer' };
        }
        onInitialize() {
            this._map = window.L.Map.THIS;
            this._map.on('sheetgeometrychanged', this.update, this);
            this._map.on('viewrowcolumnheaders', this.update, this);
            this._map.on('darkmodechanged', this._updateColors, this);
        }
        update() {
            // Below 2 sections exist (since this section is added), unless they are being removed.
            const rowGroupSection = this.containerObject.getSectionWithName(app.CSections.RowGroup.name);
            if (rowGroupSection) {
                rowGroupSection.update(); // This will update its size.
                this.size[0] = rowGroupSection.size[0];
            }
            const columnGroupSection = this.containerObject.getSectionWithName(app.CSections.ColumnGroup.name);
            if (columnGroupSection) {
                columnGroupSection.update(); // This will update its size.
                this.size[1] = columnGroupSection.size[1];
            }
        }
        onClick() {
            cool.selectAllAndRestoreFocus(this._map);
        }
        onMouseEnter() {
            this.containerObject.getCanvasStyle().cursor = 'pointer';
        }
        onMouseLeave() {
            this.containerObject.getCanvasStyle().cursor = 'default';
        }
        // These 2 overwrites are required.
        onDraw() { return; }
        onDoubleClick() { return; }
    }
    cool.CornerGroup = CornerGroup;
})(cool || (cool = {}));

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
/*
    Calc only.
*/
/* global $ app */
var cool;
(function (cool) {
    class CornerHeader extends CanvasSectionObject {
        constructor() {
            super(app.CSections.CornerHeader.name);
            this.anchor = [[app.CSections.ColumnGroup.name, 'bottom', 'top'], [app.CSections.RowGroup.name, 'right', 'left']];
            this.size = [48 * app.dpiScale, 19 * app.dpiScale]; // These values are static.
            this.processingOrder = app.CSections.CornerHeader.processingOrder;
            this.drawingOrder = app.CSections.CornerHeader.drawingOrder;
            this.zIndex = app.CSections.CornerHeader.zIndex;
            this.sectionProperties = { cursor: 'pointer' };
        }
        onInitialize() {
            this._map = window.L.Map.THIS;
            this._map.on('darkmodechanged', this._initCornerHeaderStyle, this);
            this._initCornerHeaderStyle();
        }
        onClick() {
            cool.selectAllAndRestoreFocus(this._map);
        }
        onMouseEnter() {
            this.containerObject.getCanvasStyle().cursor = this.sectionProperties.cursor;
        }
        onMouseLeave() {
            this.containerObject.getCanvasStyle().cursor = 'default';
        }
        _initCornerHeaderStyle() {
            const baseElem = document.getElementsByTagName('body')[0];
            const elem = window.L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
            this._textColor = window.L.DomUtil.getStyle(elem, 'color');
            this.backgroundColor = window.L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
            this.borderColor = window.L.DomUtil.getStyle(elem, 'border-top-color'); // This is a section property.
            window.L.DomUtil.remove(elem);
        }
    }
    cool.CornerHeader = CornerHeader;
})(cool || (cool = {}));

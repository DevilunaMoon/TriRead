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
var cool;
(function (cool) {
    class HeaderFooterBoundarySection extends CanvasSectionObject {
        constructor() {
            super(app.CSections.HeaderFooterBoundary.name);
            this.processingOrder = app.CSections.HeaderFooterBoundary.processingOrder;
            this.drawingOrder = app.CSections.HeaderFooterBoundary.drawingOrder;
            this.zIndex = app.CSections.HeaderFooterBoundary.zIndex;
            this.interactable = false;
            this.documentObject = true;
            this.sectionProperties.pageRectangle = null;
            this.sectionProperties.headerRectangle = null;
            this.sectionProperties.footerRectangle = null;
        }
        onInitialize() {
            app.map.on('zoomend', () => {
                this.setPositionAndSize();
                app.sectionContainer.requestReDraw();
            });
        }
        update(json) {
            if (json.hide) {
                this.sectionProperties.pageRectangle = null;
                this.sectionProperties.headerRectangle = null;
                this.sectionProperties.footerRectangle = null;
            }
            else {
                this.sectionProperties.pageRectangle = this.parseRectangle(json.page);
                this.sectionProperties.headerRectangle = this.parseRectangle(json.header);
                this.sectionProperties.footerRectangle = this.parseRectangle(json.footer);
            }
            this.setPositionAndSize();
            app.sectionContainer.requestReDraw();
        }
        parseRectangle(rect) {
            if (!rect)
                return null;
            var matches = rect.match(/-?\d+/g);
            if (!matches || matches.length < 4)
                return null;
            return [
                parseInt(matches[0]),
                parseInt(matches[1]),
                parseInt(matches[2]),
                parseInt(matches[3]),
            ];
        }
        setPositionAndSize() {
            var page = this.sectionProperties.pageRectangle;
            if (!page) {
                this.size = [0, 0];
                this.setPosition(0, 0);
                return;
            }
            this.size = [
                Math.round(page[2] * app.twipsToPixels),
                Math.round(page[3] * app.twipsToPixels),
            ];
            this.setPosition(Math.round(page[0] * app.twipsToPixels), Math.round(page[1] * app.twipsToPixels));
        }
        onResize() {
            this.setPositionAndSize();
        }
        separatorY(yTwip) {
            return Math.round(yTwip * app.twipsToPixels) - this.position[1];
        }
        drawSeparator(y) {
            this.context.save();
            this.context.strokeStyle = app.map.uiManager.isBackgroundDark()
                ? '#ffffff'
                : '#000000';
            this.context.lineWidth = this.getLineWidth();
            this.context.setLineDash([
                120 * app.twipsToPixels,
                90 * app.twipsToPixels,
            ]);
            this.context.beginPath();
            this.context.moveTo(0, y);
            this.context.lineTo(this.size[0], y);
            this.context.stroke();
            this.context.restore();
        }
        drawLabel(text, y, below) {
            var dark = window.prefs.getBoolean('darkTheme');
            var fontSize = Math.round(195 * app.twipsToPixels);
            var paddingX = Math.round(120 * app.twipsToPixels);
            var paddingY = Math.round(60 * app.twipsToPixels);
            var marginLeft = Math.round(150 * app.twipsToPixels);
            this.context.save();
            this.context.font = fontSize + 'px monospace';
            var boxWidth = this.context.measureText(text).width + 2 * paddingX;
            var boxHeight = fontSize + 2 * paddingY;
            var halfLine = this.getLineWidth() / 2;
            var boxY = below ? y + halfLine : y - boxHeight - halfLine;
            this.context.fillStyle = dark ? '#404040' : '#d9d9d9';
            this.context.fillRect(marginLeft, boxY, boxWidth, boxHeight);
            this.context.fillStyle = dark ? '#ffffff' : '#000000';
            this.context.textAlign = 'left';
            this.context.textBaseline = 'middle';
            this.context.fillText(text, marginLeft + paddingX, boxY + boxHeight / 2);
            this.context.restore();
        }
        onDraw() {
            if (!this.sectionProperties.pageRectangle)
                return;
            var header = this.sectionProperties.headerRectangle;
            if (header) {
                // boundary line = bottom edge of the header frame
                var headerY = this.separatorY(header[1] + header[3]);
                this.drawSeparator(headerY);
                this.drawLabel(_('Header'), headerY, true);
            }
            var footer = this.sectionProperties.footerRectangle;
            if (footer) {
                // boundary line = top edge of the footer frame
                var footerY = this.separatorY(footer[1]);
                this.drawSeparator(footerY);
                this.drawLabel(_('Footer'), footerY, false);
            }
        }
    }
    cool.HeaderFooterBoundarySection = HeaderFooterBoundarySection;
})(cool || (cool = {}));
app.definitions.HeaderFooterBoundarySection = cool.HeaderFooterBoundarySection;

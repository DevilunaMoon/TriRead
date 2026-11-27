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
/* global app */
/*
    This file is Calc only. This adds a section for grouped rows in Calc.
    When user selects some rows and groups them using "Data->Group and Outline->Group" menu path, this section is added into
    sections list of CanvasSectionContainer. See _addRemoveGroupSections in file CalcTileLayer.js

    This class is an extended version of "CanvasSectionObject".
*/
var cool;
(function (cool) {
    class RowGroup extends cool.GroupBase {
        constructor() {
            super(app.CSections.RowGroup.name);
            this.anchor = [[app.CSections.CornerGroup.name, 'bottom', 'top'], 'left'];
            this.expand = ['top', 'bottom']; // Expand vertically.
            this.processingOrder = app.CSections.RowGroup.processingOrder;
            this.drawingOrder = app.CSections.RowGroup.drawingOrder;
            this.zIndex = app.CSections.RowGroup.zIndex;
        }
        update() {
            if (this.isRemoved) // Prevent calling while deleting the section. It causes errors.
                return;
            this._sheetGeometry = this._map._docLayer.sheetGeometry;
            this._groups = Array(this._sheetGeometry.getRowGroupLevels());
            // Calculate width on the fly.
            this.size[0] = this._computeSectionWidth();
            this._cornerHeaderHeight = this.containerObject.getSectionWithName(app.CSections.CornerHeader.name).size[1];
            this._splitPos = this._map._docLayer._splitPanesContext.getSplitPos();
            this._collectGroupsData(this._sheetGeometry.getRowGroupsDataInView());
        }
        onNewDocumentTopLeft() {
            this.update();
        }
        // This returns the required width for the section.
        _computeSectionWidth() {
            return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
        }
        isGroupHeaderVisible(startY, startPos) {
            if (startPos > this._splitPos.y) {
                return startY > this._splitPos.y + this._cornerHeaderHeight;
            }
            else {
                return startY >= this._cornerHeaderHeight;
            }
        }
        getEndPosition(endPos) {
            if (endPos <= this._splitPos.y)
                return endPos;
            else {
                return Math.max(endPos + this._cornerHeaderHeight - app.activeDocument.activeLayout.viewedRectangle.pY1, this._splitPos.y + this._cornerHeaderHeight);
            }
        }
        getRelativeY(docPos) {
            if (docPos < this._splitPos.y)
                return docPos + this._cornerHeaderHeight;
            else
                return Math.max(docPos - app.activeDocument.activeLayout.viewedRectangle.pY1, this._splitPos.y) + this._cornerHeaderHeight;
        }
        _getGroupAnchorPos(group) {
            return [this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group.level, this.getRelativeY(group.startPos)];
        }
        _getLevelHeaderPos(level) {
            return [this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * level, Math.round((this._cornerHeaderHeight - this._groupHeadSize) * 0.5)];
        }
        _getOutlineType() {
            return 'row';
        }
        drawGroupControl(group) {
            let [startX, startY] = this._getGroupAnchorPos(group);
            startX = Math.round(startX);
            startY = Math.round(startY);
            const endY = this.getEndPosition(group.endPos);
            const strokeColor = this.getColors().strokeColor;
            if (this.isGroupHeaderVisible(startY, group.startPos)) {
                this.drawGroupBoxes(startX, startY, group.hidden);
            }
            if (!group.hidden && endY > this._cornerHeaderHeight + this._groupHeadSize && endY > startY) {
                //draw tail
                this.context.beginPath();
                startY += this._groupHeadSize;
                startY = startY >= this._cornerHeaderHeight + this._groupHeadSize ? startY : this._cornerHeaderHeight + this._groupHeadSize;
                startX += this._groupHeadSize * 0.5;
                startX = Math.round(startX);
                startY = Math.round(startY) + 1;
                this.context.strokeStyle = strokeColor;
                this.context.lineWidth = 1.0;
                this.context.moveTo(this.transformX(startX) + 0.5, Math.round(startY) + 0.5);
                this.context.lineTo(this.transformX(startX) + 0.5, Math.round(endY - app.roundedDpiScale) + 0.5);
                this.context.stroke();
                this.context.lineTo(Math.round(this.transformX(startX + this._groupHeadSize / 2)) + 0.5, Math.round(endY - app.roundedDpiScale) + 0.5);
                this.context.stroke();
            }
        }
        // When user clicks somewhere on the section, onMouseClick event is called by CanvasSectionContainer.
        // Clicked point is also given to handler function. This function finds the clicked header.
        findClickedLevel(point) {
            if (point.pY < this._cornerHeaderHeight) {
                let index = (this.transformX(point.pX) / this.size[0]) * 100; // Percentage.
                const levelPercentage = (1 / (this._groups.length + 1)) * 100; // There is one more button than the number of levels.
                index = Math.floor(index / levelPercentage);
                return index;
            }
            return -1;
        }
        getTailsGroupRect(group) {
            const [startX, startY] = this._getGroupAnchorPos(group);
            const endX = startX + this._groupHeadSize; // Let's use this as thikcness. User doesn't have to double click on a pixel:)
            const endY = group.endPos + this._cornerHeaderHeight - app.activeDocument.activeLayout.viewedRectangle.pY1;
            return [startX, endX, startY, endY];
        }
        onRemove() {
            this.isRemoved = true;
            this.containerObject.getSectionWithName(app.CSections.RowHeader.name).position[0] = 0;
            this.containerObject.getSectionWithName(app.CSections.CornerHeader.name).position[0] = 0;
        }
    }
    cool.RowGroup = RowGroup;
})(cool || (cool = {}));

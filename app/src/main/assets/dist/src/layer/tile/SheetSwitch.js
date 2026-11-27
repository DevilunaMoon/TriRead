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
    // SheetSwitchViewRestore is used to store the last view position of a sheet
    // before a sheet switch so that when the user switches back to previously used
    // sheets we can restore the last scroll position of that sheet.
    class SheetSwitchViewRestore {
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        constructor(map) {
            this.map = map;
            this.docLayer = this.map._docLayer;
            this.centerOfSheet = new Map();
            this.mayRestore = false;
            this.restorePart = -1;
            this.setPartRecvd = false;
            this.currentSheetIndexReassigned = false;
        }
        save(toPart) {
            Util.ensureValue(app.activeDocument);
            if (!this.currentSheetIndexReassigned) {
                this.centerOfSheet.set(this.docLayer._selectedPart, app.activeDocument.activeLayout.viewedRectangle.clone());
            }
            else {
                this.currentSheetIndexReassigned = false;
            }
            this.mayRestore = this.centerOfSheet.has(toPart);
            this.restorePart = this.mayRestore ? toPart : -1;
            this.setPartRecvd = false;
        }
        updateOnSheetMoved(oldIndex, newIndex) {
            if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex)
                return;
            const movedSheetCenter = this.centerOfSheet.get(oldIndex);
            if (oldIndex < newIndex) {
                for (let i = oldIndex; i < newIndex; ++i) {
                    const center = this.centerOfSheet.get(i + 1);
                    if (center)
                        this.centerOfSheet.set(i, center);
                    else
                        this.centerOfSheet.delete(i);
                }
            }
            else {
                for (let i = oldIndex; i > newIndex; --i) {
                    const center = this.centerOfSheet.get(i - 1);
                    if (center)
                        this.centerOfSheet.set(i, center);
                    else
                        this.centerOfSheet.delete(i);
                }
            }
            if (movedSheetCenter)
                this.centerOfSheet.set(newIndex, movedSheetCenter);
            else
                this.centerOfSheet.delete(newIndex);
        }
        updateOnSheetInsertion(index) {
            if (index < 0)
                return;
            Util.ensureValue(app.activeDocument);
            // when insert a sheet
            this.centerOfSheet.set(this.docLayer._selectedPart, app.activeDocument.activeLayout.viewedRectangle.clone());
            const numberOfSheets = this.map.getNumberOfParts();
            for (let i = numberOfSheets; i > index; --i) {
                const center = this.centerOfSheet.get(i - 1);
                if (center)
                    this.centerOfSheet.set(i, center);
                else
                    this.centerOfSheet.delete(i);
            }
            this.centerOfSheet.delete(index);
            const currentSheetNumber = this.map.getCurrentPartNumber();
            this.currentSheetIndexReassigned = index <= currentSheetNumber;
            if (this.currentSheetIndexReassigned) {
                this.centerOfSheet.set(currentSheetNumber + 1, app.activeDocument.activeLayout.viewedRectangle.clone());
            }
        }
        updateOnSheetDeleted(index) {
            if (index < 0)
                return;
            const numberOfSheets = this.map.getNumberOfParts();
            for (let i = index; i < numberOfSheets; ++i) {
                const center = this.centerOfSheet.get(i + 1);
                if (center)
                    this.centerOfSheet.set(i, center);
                else
                    this.centerOfSheet.delete(i);
            }
            Util.ensureValue(app.activeDocument);
            const currentSheetNumber = this.map.getCurrentPartNumber();
            this.currentSheetIndexReassigned = index <= currentSheetNumber;
            if (index < currentSheetNumber) {
                this.centerOfSheet.set(currentSheetNumber - 1, app.activeDocument.activeLayout.viewedRectangle.clone());
            }
        }
        gotSetPart(part) {
            this.setPartRecvd = (part === this.restorePart);
        }
        // This resets the flags but not the center map.
        reset() {
            this.restorePart = -1;
            this.mayRestore = false;
        }
        // The scrollable area is still the one of the sheet being left, so it is grown first
        // to reach the saved position. Without that the scroll is clamped to that area.
        scrollToSavedPosition(center) {
            Util.ensureValue(app.activeDocument);
            this.docLayer.extendDocumentSizeToInclude(new cool.SimplePoint(center.x1, center.y1));
            app.activeDocument.activeLayout.scrollTo(center.pX1, center.pY1);
        }
        // Moves the view to the saved position of the sheet being switched to, at the time
        // of the switch, so the tiles requested for it are the ones at that position. The
        // flags stay as they are: the cell-cursor driven restore still runs afterwards.
        restoreOnSwitch() {
            if (!this.mayRestore)
                return;
            const center = this.centerOfSheet.get(this.restorePart);
            if (center === undefined)
                return;
            this.scrollToSavedPosition(center);
        }
        restoreView() {
            const center = this.centerOfSheet.get(this.restorePart);
            if (center === undefined) {
                this.reset();
                return;
            }
            this.scrollToSavedPosition(center);
            // Keep restoring view for every cell-cursor messages until we get this
            // call after receiving cell-cursor msg after setpart incoming msg.
            // Because it is guaranteed that cell-cursor messages belong to the new part
            // after setpart(incoming) msg.
            if (this.setPartRecvd)
                this.reset();
        }
        // This should be called to restore sheet's last scroll position if necessary and
        // returns whether the map should scroll to current cursor.
        tryRestore(duplicateCursor, currentPart) {
            let shouldScrollToCursor = false;
            const attemptRestore = (this.mayRestore && currentPart === this.restorePart);
            if (attemptRestore) {
                if (this.setPartRecvd && duplicateCursor)
                    this.reset();
                if (!this.setPartRecvd)
                    this.restoreView();
            }
            if ((!attemptRestore || this.setPartRecvd) && !duplicateCursor)
                shouldScrollToCursor = true;
            return shouldScrollToCursor;
        }
    }
    cool.SheetSwitchViewRestore = SheetSwitchViewRestore;
})(cool || (cool = {}));

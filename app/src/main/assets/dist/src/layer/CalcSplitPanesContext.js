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
var cool;
(function (cool) {
    class CalcSplitPanesContext extends cool.SplitPanesContext {
        _setDefaults() {
            this._splitPos = new cool.Point(0, 0);
            this._splitCell = new cool.Point(0, 0);
        }
        setSplitCol(splitCol) {
            console.assert(typeof splitCol === 'number', 'invalid argument type');
            return this._splitCell.setX(splitCol);
        }
        setSplitRow(splitRow) {
            console.assert(typeof splitRow === 'number', 'invalid argument type');
            return this._splitCell.setY(splitRow);
        }
        /// Calculates the split position in (core-pixels) from the split-cell.
        setSplitPosFromCell(forceSplittersUpdate) {
            if (this._docLayer.sheetGeometry.getPart() !== this._docLayer._selectedPart)
                return;
            var newSplitPos = this._docLayer.sheetGeometry.getCellRect(this._splitCell.x, this._splitCell.y).min;
            // setSplitPos limits the split position based on the screen size and it fires 'splitposchanged' (if there is any change).
            // setSplitCellFromPos gets invoked on 'splitposchanged' to sync the split-cell with the position change if any.
            this.setSplitPos(newSplitPos.x, newSplitPos.y, forceSplittersUpdate);
            // It is possible that the split-position did not change due to screen size limits, so no 'splitposchanged' but
            // we still need to sync the split-cell.
            this.setSplitCellFromPos();
        }
        // Calculates the split-cell from the split position in (core-pixels).
        setSplitCellFromPos() {
            // This should not call setSplitPosFromCell() directly/indirectly.
            var newSplitCell = this._docLayer.sheetGeometry.getCellFromPos(this._splitPos, 'corepixels');
            // Send new state via uno commands if there is any change.
            if (!this._docLayer.dontSendSplitPosToCore) {
                this.setSplitCol(newSplitCell.x) && this._docLayer.sendSplitIndex(newSplitCell.x, true /*  isSplitCol */);
                this.setSplitRow(newSplitCell.y) && this._docLayer.sendSplitIndex(newSplitCell.y, false /* isSplitCol */);
            }
        }
    }
    cool.CalcSplitPanesContext = CalcSplitPanesContext;
})(cool || (cool = {}));

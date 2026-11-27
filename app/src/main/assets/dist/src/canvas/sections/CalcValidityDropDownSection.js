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
class CalcValidityDropDown extends HTMLObjectSection {
    static { this.dropDownArrowSize = 16; } // Size of the validity drop-down arrow in CSS pixels.
    constructor(documentPosition, visible = true) {
        super(app.CSections.CalcValidityDropDown.name, CalcValidityDropDown.dropDownArrowSize, CalcValidityDropDown.dropDownArrowSize, documentPosition, 'spreadsheet-drop-down-marker', visible);
        this.zIndex = app.CSections.CalcValidityDropDown.zIndex;
        this.sectionProperties.mouseEntered = false;
    }
    onMouseEnter(point, e) {
        this.sectionProperties.mouseEntered = true;
    }
    onMouseLeave() {
        this.sectionProperties.mouseEntered = false;
    }
    onClick(point, e) {
        e.stopPropagation();
        e.preventDefault();
        this.stopPropagating();
        const _validatedCellAddress = app.map._docLayer._validatedCellAddress;
        if (_validatedCellAddress && app.calc.cellCursorVisible && _validatedCellAddress.equals(app.calc.cellAddress?.toArray() ?? [])) {
            app.map.sendUnoCommand('.uno:DataSelect');
        }
    }
}

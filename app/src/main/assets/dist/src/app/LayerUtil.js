/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// CStyleData is used to obtain CSS property values from style data
// stored in DOM elements in the form of custom CSS properties/variables.
class CStyleData extends BaseClass {
    constructor(styleDataDiv) {
        super();
        this._div = styleDataDiv;
    }
    getPropValue(name) {
        return getComputedStyle(this._div).getPropertyValue(name);
    }
    getIntPropValue(name) {
        return parseInt(this.getPropValue(name));
    }
    getFloatPropValue(name) {
        return parseFloat(this.getPropValue(name));
    }
    getFloatPropWithoutUnit(name) {
        let value = this.getPropValue(name);
        if (value.indexOf('px'))
            value = value.split('px')[0];
        return parseFloat(value);
    }
}
// CSelections is used to add/modify/clear selections (text/cell-area(s)/ole)
// on canvas using polygons (CPolygon).
class CSelections extends BaseClass {
    constructor(pointSet, canvasOverlay, selectionsDataDiv, map, isView, viewId, selectionType) {
        super();
        this._pointSet = pointSet ? pointSet : new CPointSet();
        this._overlay = canvasOverlay;
        this._styleData = new CStyleData(selectionsDataDiv);
        this._map = map;
        this._name = 'selections' + (isView ? '-viewid-' + viewId : '');
        this._isView = isView;
        this._viewId = viewId;
        this._isText = selectionType === 'text';
        this._isOle = selectionType === 'ole';
        this._selection = undefined;
        this._updateSelection();
    }
    empty() {
        return !this._pointSet || this._pointSet.empty();
    }
    clear() {
        this.setPointSet(new CPointSet());
    }
    setPointSet(pointSet) {
        this._pointSet = pointSet;
        this._updateSelection();
    }
    contains(corePxPoint) {
        if (!this._selection)
            return false;
        return this._selection.anyRingBoundContains(corePxPoint);
    }
    getBounds() {
        return this._selection.getBounds();
    }
    _updateSelection() {
        let attributes;
        if (!this._selection) {
            if (!this._isOle) {
                const fillColor = this._isView
                    ? app.LOUtil.rgbToHex(this._map.getViewColor(this._viewId))
                    : this._styleData.getPropValue('background-color');
                const opacity = this._styleData.getFloatPropValue('opacity');
                const weight = this._styleData.getFloatPropWithoutUnit('border-top-width');
                attributes = this._isText
                    ? {
                        viewId: this._isView ? this._viewId : undefined,
                        groupType: PathGroupType.TextSelection,
                        name: this._name,
                        pointerEvents: 'none',
                        fillColor: fillColor,
                        fillOpacity: opacity,
                        color: fillColor,
                        opacity: 0.6,
                        stroke: true,
                        fill: true,
                        weight: 1.0,
                    }
                    : {
                        viewId: this._isView ? this._viewId : undefined,
                        name: this._name,
                        pointerEvents: 'none',
                        color: fillColor,
                        fillColor: fillColor,
                        fillOpacity: opacity,
                        opacity: 1.0,
                        weight: Math.round(weight * app.dpiScale),
                    };
            }
            else {
                attributes = {
                    pointerEvents: 'none',
                    fillColor: 'black',
                    fillOpacity: 0.25,
                    weight: 0,
                    opacity: 0.25,
                    fixed: true,
                };
            }
            if (this._isText) {
                this._selection = new CPolygon(this._pointSet, attributes);
            }
            else if (this._isOle) {
                this._selection = new CDarkOverlay(this._pointSet, attributes);
            }
            else {
                this._selection = new CCellSelection(this._pointSet, attributes);
            }
            if (this._isText)
                this._overlay.initPath(this._selection);
            else
                this._overlay.initPathGroup(this._selection);
            return;
        }
        this._selection.setPointSet(this._pointSet);
    }
    remove() {
        if (!this._selection)
            return;
        if (this._isText)
            this._overlay.removePath(this._selection);
        else
            this._overlay.removePathGroup(this._selection);
    }
}
// CReferences is used to store and manage the CPath's of all
// references in the current sheet.
class CReferences extends BaseClass {
    constructor(canvasOverlay) {
        super();
        this._overlay = canvasOverlay;
        this._marks = [];
    }
    addMark(mark) {
        this._overlay.initPath(mark);
        this._marks.push(mark);
    }
    hasMark(mark) {
        for (let i = 0; i < this._marks.length; ++i) {
            if (mark.getBounds().equals(this._marks[i].getBounds()))
                return true;
        }
        return false;
    }
    empty() {
        return this._marks.length === 0;
    }
    clear() {
        for (let i = 0; i < this._marks.length; ++i)
            this._overlay.removePath(this._marks[i]);
        this._marks = [];
    }
}

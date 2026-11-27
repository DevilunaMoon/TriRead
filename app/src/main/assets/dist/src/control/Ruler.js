// @ts-strict-ignore
/**
 /*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Ruler.ts - Base Class for Ruler Functionality
 *
 * This file defines the engine logic for the Ruler feature, shared by both
 * horizontal (HRuler) and vertical (VRuler) implementations.
 *
 * ### Key Features:
 * - **Configurable Options**: Supports margins, tab stops, interactivity, and display settings.
 * - **Abstract Design**: Subclasses must implement `_updateBreakPoints()` for specific behaviors.
 * - **Shared Utilities**: Includes reusable methods like `_updatePaintTimer` and `getWindowProperty`.
 * - **Easy Initialization**: `initializeRuler` simplifies setup for HRuler and VRuler.
 *
 * ### Guidelines:
 * - Extend the `Options` interface for new features.
 * - Implement subclass-specific logic in `_updateBreakPoints()`.
 * - Ensure event handling (e.g., `rulerchanged`) for updates.
 */
class Ruler {
    constructor(options) {
        this._updateTask = null;
        this._offsetTask = null;
        // One value tooltip per indent marker, shown together on hover/drag.
        this._indentTooltips = [];
        // Value tooltip for each margin handle, keyed by the handle element.
        this._marginTooltips = new Map();
        // Init default values for ruler options
        this.options = {
            interactive: true,
            marginSet: false,
            displayNumber: true,
            tileMargin: 18,
            margin1: null,
            margin2: null,
            leftOffset: null,
            pageOffset: null,
            pageWidth: null,
            pageTopMargin: null,
            pageBottomMargin: null,
            firstLineIndent: null,
            leftParagraphIndent: null,
            rightParagraphIndent: null,
            tabs: '',
            tabsRelativeToIndent: false,
            unit: null,
            DraggableConvertRatio: null,
            timer: null,
            showruler: true,
            position: 'topleft',
            disableMarker: false,
            ...options,
        };
    }
    // Engine reports the page geometry and the indents in mm100, so both scales
    // below start there: 2540 mm100 and 1440 twips make up an inch.
    _twipsFromMm100(mm100) {
        return (mm100 * 1440) / 2540;
    }
    // CSS pixels per mm100 at the current zoom, through the live zoom factor.
    _pixelsPerMm100() {
        return (this._twipsFromMm100(1) * app.twipsToPixels) / app.dpiScale;
    }
    _updatePaintTimer() {
        clearTimeout(this.options.timer);
        this.options.timer = setTimeout(window.L.bind(this._updateBreakPoints, this), 300);
    }
    _updateParagraphIndentations() {
        if (this._updateTask)
            app.layoutingService.cancelLayoutingTask(this._updateTask);
        this._updateTask = app.layoutingService.appendLayoutingTask(this._updateParagraphIndentationsImpl.bind(this));
    }
    getWindowProperty(propertyName) {
        return window[propertyName];
    }
    // Swap an indent marker between its resting icon and its filled icon while
    // it is grabbed, so the dragged marker stands out as a solid darker handle.
    // The base icon name is read from the marker's data-indent-icon attribute.
    // The resting icon and its dark-theme handling are set up once through
    // LOUtil.setImage; this only overrides the image for the duration of a drag,
    // still resolving the path through getImageURL so the dark variant is used.
    _setIndentMarkerGrabbed(marker, grabbed) {
        const base = marker.dataset.indentIcon;
        if (!base)
            return;
        const name = base + (grabbed ? '_filled' : '') + '.svg';
        marker.style.backgroundImage =
            'url("' + app.LOUtil.getImageURL(name) + '")';
    }
    // ---- Indent value tooltips (shared by both rulers) ----------------------
    //
    // Each indent marker gets a floating value tooltip. Hovering or dragging a
    // marker shows all of them at once, with the active marker focused (icon +
    // label + value) and the others as plain value chips. Subclasses supply the
    // marker set, the value sources and the placement.
    // Create one value tooltip per marker and wire hover to show them. Call this
    // from the subclass once its markers exist.
    _initIndentTooltips(markers) {
        this._destroyIndentTooltips();
        this._indentTooltips = markers.map((m) => ({
            ...m,
            tip: new ValueTooltip(),
        }));
        this._indentTooltips.forEach((spec) => {
            window.L.DomEvent.on(spec.marker, 'mouseenter', () => this._showIndentTooltips(spec.id), this);
            window.L.DomEvent.on(spec.marker, 'mouseleave', () => {
                if (!this._map.rulerActive)
                    this._hideIndentTooltips();
            }, this);
        });
    }
    _destroyIndentTooltips() {
        this._indentTooltips.forEach((s) => s.tip.destroy());
        this._indentTooltips = [];
    }
    _showIndentTooltips(focusedId) {
        if (!this._indentTooltips.length || !this._map.isEditMode())
            return;
        // Resting values come from engine; the focused marker previews its live
        // value from the moving marker position while a drag is in progress.
        const display = this._indentDisplayValuesMm100();
        if (!display)
            return;
        const live = this._map.rulerActive ? this._indentLiveValuesMm100() : null;
        this._indentTooltips.forEach((spec) => {
            let mm100 = display[spec.id];
            if (live && spec.id === focusedId)
                mm100 = live[spec.id];
            spec.tip.render({
                focused: spec.id === focusedId,
                iconName: spec.iconName,
                label: spec.label,
                value: this._formatIndentValue(mm100),
            });
            spec.tip.show();
        });
        // Width and height are known only once shown, so place after showing.
        this._positionIndentTooltips(this._indentTooltips);
    }
    _hideIndentTooltips() {
        this._indentTooltips.forEach((s) => s.tip.hide());
    }
    // Indent value in centimetres, no unit suffix (the chips show just a
    // number). The ruler ticks are always centimetres.
    _formatIndentValue(mm100) {
        return (mm100 / 1000).toFixed(2);
    }
    // ---- Margin handle tooltips (shared by both rulers) ---------------------
    // Format an mm100 value as a 2-decimal centimetre string with the unit. The
    // ruler ticks are always drawn in centimetres, so the value is shown in cm
    // regardless of the document's measurement unit.
    _formatRulerValue(mm100) {
        return (mm100 / 1000).toFixed(2) + ' cm';
    }
    // The margin equals the drag handle's own width. This avoids depending on
    // page margin options that can be undefined.
    _currentMarginMm100(elem) {
        const widthPx = parseFloat(elem.style.width) || 0;
        return widthPx / this.options.DraggableConvertRatio;
    }
    // Attach a value tooltip to a margin handle. It appears at the pointer on
    // hover and stays put, and remains visible while the handle is dragged.
    _setupMarginTooltip(elem, label, iconName) {
        const tip = new ValueTooltip();
        this._marginTooltips.set(elem, { tip, label, iconName });
        window.L.DomEvent.on(elem, 'mouseenter', (e) => {
            this._renderMarginTooltip(elem);
            tip.show();
            tip.placeNearPoint(e.clientX, e.clientY);
            // Moving onto a margin handle hides the indent tooltips so the
            // two do not overlap.
            this._hideIndentTooltips();
        }, this);
        window.L.DomEvent.on(elem, 'mouseleave', () => {
            if (!this._map.rulerActive)
                tip.hide();
        }, this);
    }
    _renderMarginTooltip(elem) {
        const m = this._marginTooltips.get(elem);
        if (!m)
            return;
        m.tip.render({
            focused: true,
            iconName: m.iconName,
            label: m.label,
            value: this._formatRulerValue(this._currentMarginMm100(elem)),
        });
    }
    // Show a margin handle's tooltip as a drag starts. It keeps the position set
    // when the pointer entered the handle.
    _pinMarginTooltip(elem) {
        const m = this._marginTooltips.get(elem);
        if (!m)
            return;
        this._renderMarginTooltip(elem);
        m.tip.show();
    }
    // Refresh the live value on a margin handle's tooltip during a drag.
    _updateMarginTooltip(elem) {
        this._renderMarginTooltip(elem);
    }
    _hideMarginTooltips() {
        this._marginTooltips.forEach((m) => m.tip.hide());
    }
    _destroyMarginTooltips() {
        this._marginTooltips.forEach((m) => m.tip.destroy());
        this._marginTooltips.clear();
    }
    // Static method to handle the initialization of rulers
    static initializeRuler(map, options) {
        const isRTL = document.documentElement.dir === 'rtl';
        const interactiveRuler = map.isEditMode();
        const showRuler = options.showruler ?? true;
        // Initialize the horizontal ruler
        new HRuler(map, {
            position: isRTL ? 'topright' : 'topleft',
            interactive: interactiveRuler,
            showruler: showRuler,
        });
        // Initialize the vertical ruler if not in presentation or drawing mode
        if (!map.isPresentationOrDrawing()) {
            new VRuler(map, {
                position: isRTL ? 'topright' : 'topleft',
                interactive: interactiveRuler,
                showruler: showRuler,
            });
        }
        if (showRuler)
            map.uiManager.showRuler();
    }
    // The screen position of the top-left corner of the page the text cursor is
    // on, in CSS pixels. The stacked page grid gives every page its own screen
    // slot, so a ruler that belongs to one page starts here. Null while the page
    // geometry has not arrived yet.
    _cursorPageScreenPosition() {
        const layout = app.activeDocument.activeLayout;
        const pageRectangleList = app.file.writer.pageRectangleList;
        if (pageRectangleList.length === 0)
            return null;
        let pageIndex = 0;
        const cursorRectangle = app.file.textCursor.rectangle;
        if (cursorRectangle) {
            const cursorPoint = new cool.SimplePoint(cursorRectangle.x1, cursorRectangle.y1);
            pageIndex = layout.getClosestRectangleIndex(cursorPoint);
        }
        const pageRectangle = pageRectangleList[pageIndex];
        const pageTopLeft = new cool.SimplePoint(pageRectangle[0], pageRectangle[1]);
        // Both corners are mapped through the one page index resolved above, so
        // the two coordinates always describe the same page.
        const screenPosition = layout.documentPointToScreenWithIndex(pageTopLeft, pageIndex);
        return {
            x: screenPosition.x / app.dpiScale,
            y: screenPosition.y / app.dpiScale,
        };
    }
    fixOffset() {
        if (this._offsetTask)
            app.layoutingService.cancelLayoutingTask(this._offsetTask);
        this._offsetTask = app.layoutingService.appendLayoutingTask(() => {
            this._offsetTask = null;
            this._fixOffsetImpl();
        });
    }
}
app.definitions.ruler = Ruler;

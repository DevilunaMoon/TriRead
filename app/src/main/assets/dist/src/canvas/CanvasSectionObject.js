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
// This class will be used internally by CanvasSectionContainer.
class CanvasSectionObject {
    constructor(name) {
        this.myTopLeft = [0, 0];
        this.containerObject = null;
        this.name = null;
        this.backgroundColor = null; // Default is null (container's background color will be used).
        this.backgroundOpacity = 1; // Valid when backgroundColor is valid.
        this.borderColor = null; // Default is null (no borders).
        this.boundToSection = null;
        this.anchor = [];
        this.documentObject = false; // If true, the section is a document object.
        this.documentPosition = new cool.SimplePoint(0, 0); // Used with document objects.
        this.boundingRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
        // When section is a document object, its position should be the real position inside the document, in core pixels.
        this.isVisible = false; // Is section visible on the viewed area of the document? This property is valid for document objects. This is managed by the section container.
        this.showSection = true; // Show / hide section.
        this.position = [0, 0];
        this.size = [0, 0];
        this.expand = [];
        this.interactable = true;
        this.isAnimating = false;
        this.isAlwaysVisible = false;
        this.windowSection = false;
        this.sectionProperties = {};
        this.boundsList = []; // The sections those this section can propagate events to. Updated by container.
        this.name = name;
        if (this.documentObject) {
            this.documentPosition = cool.SimplePoint.fromCorePixels([...this.position]);
            this.boundingRectangle = cool.SimpleRectangle.fromCorePixels([...this.position, ...this.size]);
        }
    }
    onInitialize() { return; }
    onCursorPositionChanged(newPosition) { return; }
    onCellAddressChanged() { return; }
    onMouseMove(point, dragDistance, e) { return; }
    onMouseDown(point, e) { return; }
    onMouseUp(point, e) { return; }
    /// The drag this section started is off, and what it was showing of it goes.
    onDragCancel() { return; }
    setShowSection(show) {
        this.showSection = show;
        if (this.onSectionShowStatusChange)
            this.onSectionShowStatusChange();
        if (this.containerObject) { // Is section added to container.
            this.isVisible = this.containerObject.isDocumentObjectVisible(this);
            this.onDocumentObjectVisibilityChange();
            if (this.containerObject.testing)
                this.containerObject.createUpdateSingleDivElement(this);
        }
    }
    onSectionShowStatusChange() { return; } /// Called when setShowSection is called.
    isSectionShown() {
        return this.showSection;
    }
    onDocumentObjectVisibilityChange() { return; }
    onMouseEnter(point, e) { return; }
    onMouseLeave(point, e) { return; }
    onClick(point, e) { return; }
    onMiddleClick(point, e, openHyperlink) { return; }
    onDoubleClick(point, e) { return; }
    onContextMenu(point, e) { return; }
    onMouseWheel(point, delta, e) { return; }
    onMultiTouchStart(e) { return; }
    onMultiTouchMove(point, dragDistance, e) { return; }
    onMultiTouchEnd(e) { return; }
    onDrop(point, e) { return; }
    onResize() { return; }
    onDraw(frameCount, elapsedTime) { return; }
    onDrawArea(area, paneTopLeft, canvasContext) { return; } // area is the area to be painted using canvasContext.
    onAnimate(frameCount, elapsedTime) { return; }
    onAnimationEnded(frameCount, elapsedTime) { return; } // frameCount, elapsedTime. Sections that will use animation, have to have this function defined.
    onNewDocumentTopLeft() { return; }
    onRemove() { return; } // This Function is called right before section is removed.
    getHTMLObject() { return; } // Implemented in HTMLObjectSection.
    setDrawingOrder(drawingOrder) {
        this.drawingOrder = drawingOrder;
        this.containerObject.updateBoundSectionLists();
        this.containerObject.reNewAllSections();
    }
    setZIndex(zIndex) {
        this.zIndex = zIndex;
        this.containerObject.updateBoundSectionLists();
        this.containerObject.reNewAllSections();
    }
    bindToSection(sectionName) {
        this.boundToSection = sectionName;
        this.containerObject.updateBoundSectionLists();
        this.containerObject.reNewAllSections();
    }
    stopPropagating(e = null) {
        this.containerObject.lowestPropagatedBoundSection = this.name;
        // We shouldn't need e when we remove map element.
        if (e) { // This addition doesn't effect current uses of this function, since they don't send e here.
            if (e.preventDefault)
                e.preventDefault();
            if (e.stopImmediatePropagation)
                e.stopImmediatePropagation();
            e.preventedDefault = true; // Tap events are first handled by touchGesture. We need to let it know if we handled the event.
        }
    }
    startAnimating(options) {
        return this.containerObject.startAnimating(this.name, options);
    }
    resetAnimation() {
        this.containerObject.resetAnimation(this.name);
    }
    getTestDiv() {
        var element = document.getElementById('test-div-' + this.name);
        if (element)
            return element;
        return null;
    }
    setSize(w, h) {
        if (!this.containerObject)
            return;
        w = Math.round(w);
        h = Math.round(h);
        if (this.size[0] === w && this.size[1] === h)
            return;
        this.size = [w, h];
    }
    // Document objects only.
    setPosition(x, y) {
        if (this.documentObject !== true || !this.containerObject)
            return;
        x = Math.round(x);
        y = Math.round(y);
        // Setting the position.
        this.position[0] = x;
        this.position[1] = y;
        this.documentPosition = cool.SimplePoint.fromCorePixels([x, y]);
        this.boundingRectangle = cool.SimpleRectangle.fromCorePixels([...[x, y], ...this.size]);
        this.myTopLeft[0] = this.documentPosition.vX;
        this.myTopLeft[1] = this.documentPosition.vY;
        // Visibility check.
        const isVisible = this.containerObject.isDocumentObjectVisible(this);
        if (isVisible !== this.isVisible) {
            this.isVisible = isVisible;
            this.onDocumentObjectVisibilityChange();
        }
        if (this.containerObject.testing)
            this.containerObject.createUpdateSingleDivElement(this);
    }
    /*
        Allow locally to influence if this object is hit by the given point.
        This can be used e.g. to have CanvasSectionObjects with 'holes',
        e.g. a frame around something and you only want the frame to be hittable
    */
    isHit(point) {
        const addition = (this.documentObject === true && app.map._docLayer.isCalcRTL()) ? -this.size[0] : 0;
        // return result of inside local range (position, size) check
        return ((point[0] >= this.myTopLeft[0] + addition && point[0] <= this.myTopLeft[0] + addition + this.size[0]) &&
            (point[1] >= this.myTopLeft[1] && point[1] <= this.myTopLeft[1] + this.size[1]));
    }
    goToSection() {
        const point = new cool.SimplePoint(this.position[0] * app.pixelsToTwips, this.position[1] * app.pixelsToTwips);
        var isNewCursorVisible = app.isPointVisibleInTheDisplayedArea(point.toArray());
        if (!isNewCursorVisible)
            app.map._docLayer.scrollToPos(point);
    }
    // All below functions should be included in their respective section definitions (or other classes), not here.
    isCalcRTL() { return; }
    setViewResolved(on) { return; }
    setView(on) { return; }
    scrollVerticalWithOffset(offset) { return; }
    remove(id) { return; }
    deleteThis() { return; }
    getActiveEdit() { return; }
    isMobileCommentActive() { return false; }
    getMobileCommentModalId() { return ''; }
    rejectAllTrackedCommentChanges() { return; }
    removeHighlighters() { return; }
    showUsernamePopUp() { return; }
    _selectColumn(colNumber, modifier) { return; }
    _selectRow(row, modifier) { return; }
    insertColumnBefore(index) { return; }
    insertRowAbove(index) { return; }
    deleteColumn(index) { return; }
    deleteRow(index) { return; }
    resetStrokeStyle() { return; }
    hasAnyComments() { return false; }
    /// Updates sectionProperties.polygonColor based on the current dark/light theme.
    changeBorderStyle() {
        const polygonColor = window.prefs.getBoolean('darkTheme') ? 'white' : 'black';
        if (this.sectionProperties.polygonColor !== polygonColor)
            this.sectionProperties.polygonColor = polygonColor;
    }
    /// Strokes the polygon stored in sectionProperties.polygon using sectionProperties.polygonColor.
    drawPolygon() {
        this.context.strokeStyle = this.sectionProperties.polygonColor;
        this.context.beginPath();
        this.context.moveTo(this.sectionProperties.polygon[0] - this.position[0], this.sectionProperties.polygon[0 + 1] - this.position[1]);
        for (let i = 0; i < this.sectionProperties.polygon.length - 1; i++) {
            this.context.lineTo(this.sectionProperties.polygon[i] - this.position[0], this.sectionProperties.polygon[i + 1] - this.position[1]);
            i += 1;
        }
        this.context.closePath();
        this.context.stroke();
    }
    /// Sets position and size from an array of twip rectangles [x, y, width, height].
    setPositionAndSizeFromTwipRectangles(rectangles) {
        var xMin = Infinity, yMin = Infinity, xMax = 0, yMax = 0;
        for (var i = 0; i < rectangles.length; i++) {
            if (rectangles[i][0] < xMin)
                xMin = rectangles[i][0];
            if (rectangles[i][1] < yMin)
                yMin = rectangles[i][1];
            if (rectangles[i][0] + rectangles[i][2] > xMax)
                xMax = rectangles[i][0] + rectangles[i][2];
            if (rectangles[i][1] + rectangles[i][3] > yMax)
                yMax = rectangles[i][1] + rectangles[i][3];
        }
        xMin = Math.round(xMin * app.twipsToPixels);
        yMin = Math.round(yMin * app.twipsToPixels);
        xMax = Math.round(xMax * app.twipsToPixels);
        yMax = Math.round(yMax * app.twipsToPixels);
        this.setPosition(xMin, yMin);
        this.size = [xMax - xMin, yMax - yMin];
        if (this.size[0] < 5)
            this.size[0] = 5;
    }
    getLineWidth() {
        if (app.dpiScale > 1.0) {
            return app.roundedDpiScale;
        }
        else {
            return app.dpiScale;
        }
    }
    getLineOffset() {
        if (app.dpiScale > 1.0) {
            return app.roundedDpiScale % 2 === 0 ? 0 : 0.5;
        }
        else {
            return 0.5;
        }
    }
    drawViewRectangle(rectangle, fill = false) {
        if (fill) {
            this.context.beginPath();
            this.context.moveTo(rectangle.v1X, rectangle.v1Y);
            this.context.lineTo(rectangle.v2X, rectangle.v2Y);
            this.context.lineTo(rectangle.v4X, rectangle.v4Y);
            this.context.lineTo(rectangle.v3X, rectangle.v3Y);
            this.context.closePath();
            this.context.fill();
        }
        else {
            this.context.beginPath();
            this.context.moveTo(rectangle.v1X - 0.5, rectangle.v1Y - 0.5);
            this.context.lineTo(rectangle.v2X - 0.5, rectangle.v2Y - 0.5);
            this.context.lineTo(rectangle.v4X - 0.5, rectangle.v4Y - 0.5);
            this.context.lineTo(rectangle.v3X - 0.5, rectangle.v3Y - 0.5);
            this.context.closePath();
            this.context.stroke();
        }
    }
}

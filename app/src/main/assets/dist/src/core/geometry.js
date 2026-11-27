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
    Notes about the design:
        * Because there are more then one definitions of rectangle and point, we need a prefix. The prefix is "Simple".
        * This file is meant to be the base for geometry classes.
        * Needs to keep things simple and maintainable:
            * Interoperability between classes is important. These classes don't get other classes as inputs.
            * There shouldn't be something like "rectangle.testSomething(otherRectangle)", instead "rectangle.testSometghing(otherRectangle.toArray())"
            * We need this approach to keep things maintainable. These classes are not base for others for now. We shouldn't force types.
            * Function inputs are primitives, like number, array of numbers, array of arrays of numbers, ..
        * We have 3 types of coordinate units in Collabora Online.
            * CSS pixels.
            * Core pixels.
            * twips.
        * Core pixels are indeed equal to Canvas pixels. So:
            * Core pixels = Canvas pixels.
        * We are using term "core pixels" in many places.
        * Why are there a CSS pixels and core / canvas pixels?
            * Because now many devices have extreme pixel densities.
            * If you render a page with traditional pixel density using CSS: the buttons, UI, whatever is on the page will be rendered very small. Because pixels are too small.
            * Browsers are solving this issue with "devicePixelRatio" variable. They are rendering the page using this variable. The result is called CSS pixels.
            * This variable is equal to: "device's pixel density" / "traditional pixel density"
            * If devicePixelRatio is different than "1", the device has a bigger pixel density than traditional devices.
            * Canvas HTML elements are using device's pixel density. So we can use high definiton images on our canvas.
            * app.dpiScale is a *divider* for converting core pixels into CSS pixels. CSS pixels conversion probably will always be used for positioning etc. of HTML elements.
            * See https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
            * CSS pixels          - The number of pixels an element would take if it were drawn on a 96 DPI display.
            * Canvas/Core pixels  - The number of pixels it took to draw an element. This can be the same as CSS pixels, it depends on `devicePixelRatio`.
            * devicePixelRatio    - The number of pixels used to draw one CSS pixel. Affected by display scaling & browser zoom.
        * We need to convert these 3 types where we need.
        * Every class is initiated with "twips" units. twips is the base unit. Every other type is calculated.
        * One can use "app.twipsToPixels", "app.pixelsToTwips" and "app.dpiScale" for initiating new classes with non-base units.
        * We use below terminology:
            * x => to get and set x.
            * pX => to get and set x using core / canvas units. Internally, it is converted into twips.
            * cX => to get and set x using CSS units. Internally, it is converted into twips.
            * vX1, vX.., vY.. => to get the screen coordinates of the points. These properties can not be set, because they depend on the view.
                -> Though sometimes we need to go from view to document. For that, we use canvasToDocumentX and canvasToDocumentY functions of the current view layout.
        * Every type has its own sub functions:
            * toArray (native-twips), cToArray (CSS), pToArray (core / canvas), containsPoint (takes number array as input), pContainsPoint, cContainsPoint and the like.
        * twips is an integer unit. We also prefer integer types here, since other types are pixels.
        * If one needs hairlines in drawing, they can always add 0.5 or something to result.
        * Our canvas uses special positioning and sizing, it doesn't / shouldn't use these classes for resizing. Sections can use these safely. See CanvasSectionContainer::onResize if curious.
        * Rounding errors:
            * Converting between units is never lossless. But once a variable is set, variable's unit should be consistent. For this:
                * We are using calculated variables inside the unit. For example, when pX2 is queried:
                    * We use "return pX1 + pWidth"
                    * If we used "(_x1 + _width) * app.twipsToPixels", we would have raised the possibility of inconsistency. Then below 2 may or may not be equal:
                        * object.pX1 + object.pWidth !== object.pX2 => We want these to be equal so we don't use "(_x1 + _width) * app.twipsToPixels".
                * This ensures the consistency once the variables are set, but the compound error increases (if one modifies the non-base values again and again, and again).
*/
var cool;
(function (cool) {
    // Simple point, for simple purposes.
    class SimplePoint {
        // Constructor uses twips.
        constructor(x, y, part = -1, mode = -1) {
            this._x = Math.round(x);
            this._y = Math.round(y);
            this.part = part;
            this.mode = mode;
        }
        // twips.
        get x() { return this._x; }
        set x(x) { this._x = Math.round(x); }
        get y() { return this._y; }
        set y(y) { this._y = Math.round(y); }
        equals(point) { return this._x === Math.round(point[0]) && this._y === Math.round(point[1]); }
        toArray() { return [this._x, this._y]; }
        distanceTo(point) { return Math.sqrt(Math.pow(this._x - point[0], 2) + Math.pow(this._y - point[1], 2)); }
        // Core / canvas pixel.
        get pX() { return Math.round(this._x * app.twipsToPixels); }
        set pX(x) { this._x = Math.round(x * app.pixelsToTwips); }
        get pY() { return Math.round(this._y * app.twipsToPixels); }
        set pY(y) { this._y = Math.round(y * app.pixelsToTwips); }
        pEquals(point) { return this.pX === Math.round(point[0]) && this.pY === Math.round(point[1]); }
        pToArray() { return [this.pX, this.pY]; }
        pDistanceTo(point) { return Math.sqrt(Math.pow(this.pX - point[0], 2) + Math.pow(this.pY - point[1], 2)); }
        // CSS pixel.
        get cX() { return Math.round(this._x * app.twipsToPixels / app.dpiScale); }
        set cX(x) { this._x = Math.round(x * app.dpiScale * app.pixelsToTwips); }
        get cY() { return Math.round(this._y * app.twipsToPixels / app.dpiScale); }
        set cY(y) { this._y = Math.round(y * app.dpiScale * app.pixelsToTwips); }
        cEquals(point) { return this.cX === Math.round(point[0]) && this.cY === Math.round(point[1]); }
        cToArray() { return [this.cX, this.cY]; }
        cDistanceTo(point) { return Math.sqrt(Math.pow(this.cX - point[0], 2) + Math.pow(this.cY - point[1], 2)); }
        clone() { return new SimplePoint(this._x, this._y, this.part, this.mode); }
        static fromCorePixels(point, part = -1, mode = -1) {
            return new SimplePoint(Math.round(point[0] * app.pixelsToTwips), Math.round(point[1] * app.pixelsToTwips), part, mode);
        }
        // View pixel.
        get vX() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewX(this) : this.pX;
        }
        get vY() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewY(this) : this.pY;
        }
        vToArray() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? [this.vX, this.vY] : [this.pX, this.pY];
        }
    }
    cool.SimplePoint = SimplePoint;
    /**
     * Represents a rectangle object which works with core pixels.
     * x1 and y1 should always <= x2 and y2. In other words width >= 0 && height >= 0 is a precondition.
     * This class doesn't check for above conditions.
     */
    class SimpleRectangle {
        // Constructor uses twips.
        constructor(x, y, width, height, part = -1, mode = -1) {
            this._x1 = Math.round(x);
            this._y1 = Math.round(y);
            this._width = Math.round(width);
            this._height = Math.round(height);
            this.part = part;
            this.mode = mode;
        }
        // twips.
        get x1() { return this._x1; }
        set x1(x1) { this._x1 = Math.round(x1); }
        get y1() { return this._y1; }
        set y1(y1) { this._y1 = Math.round(y1); }
        get x2() { return (this._x1 + this._width); }
        set x2(x2) { this._width = Math.round(x2) - this._x1; }
        get y2() { return (this._y1 + this._height); }
        set y2(y2) { this._height = Math.round(y2) - this._y1; }
        get width() { return this._width; }
        set width(width) { this._width = Math.round(width); }
        get height() { return this._height; }
        set height(height) { this._height = Math.round(height); }
        get area() { return (this._width * this._height); }
        get center() { return [(this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2]; }
        toArray() { return [this._x1, this._y1, this._width, this._height]; }
        // twips checkers for coordinate match.
        containsPoint(point) { return (Math.round(point[0]) >= this.x1 && Math.round(point[0]) <= this.x2 && Math.round(point[1]) >= this.y1 && Math.round(point[1]) <= this.y2); }
        containsX(x) { return (Math.round(x) >= this.x1 && Math.round(x) <= this.x2); }
        containsY(y) { return (Math.round(y) >= this.y1 && Math.round(y) <= this.y2); }
        containsRectangle(rectangle) { return this.containsPoint([rectangle[0], rectangle[1]]) && this.containsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
        intersectsRectangle(rectangle) {
            return app.LOUtil._doRectanglesIntersect(this.toArray(), rectangle);
        }
        equals(rectangle) { return this.x1 === Math.round(rectangle[0]) && this.y1 === Math.round(rectangle[1]) && this.width === Math.round(rectangle[2]) && this.height === Math.round(rectangle[3]); }
        moveTo(point) { this._x1 = Math.round(point[0]); this._y1 = Math.round(point[1]); }
        moveBy(point) { this._x1 += Math.round(point[0]); this._y1 += Math.round(point[1]); }
        // Pixel.
        get pX1() { return Math.round(this._x1 * app.twipsToPixels); }
        set pX1(x1) { this._x1 = Math.round(x1 * app.pixelsToTwips); }
        get pY1() { return Math.round(this._y1 * app.twipsToPixels); }
        set pY1(y1) { this._y1 = Math.round(y1 * app.pixelsToTwips); }
        get pX2() { return this.pX1 + this.pWidth; }
        set pX2(x2) { this._width = Math.round(x2 * app.pixelsToTwips) - this._x1; }
        get pY2() { return this.pY1 + this.pHeight; }
        set pY2(y2) { this._height = Math.round(y2 * app.pixelsToTwips) - this._y1; }
        get pWidth() { return Math.round(this._width * app.twipsToPixels); }
        set pWidth(width) { this._width = Math.round(width * app.pixelsToTwips); }
        get pHeight() { return Math.round(this._height * app.twipsToPixels); }
        set pHeight(height) { this._height = Math.round(height * app.pixelsToTwips); }
        get pArea() { return this.pWidth * this.pHeight; }
        get pCenter() { return [(this.pX1 + this.pX2) / 2, (this.pY1 + this.pY2) / 2]; }
        pToArray() { return [this.pX1, this.pY1, this.pWidth, this.pHeight]; }
        // Pixel checkers for coordinate match.
        pContainsPoint(point) { return (Math.round(point[0]) >= this.pX1 && Math.round(point[0]) <= this.pX2 && Math.round(point[1]) >= this.pY1 && Math.round(point[1]) <= this.pY2); }
        pContainsX(x) { return (Math.round(x) >= this.pX1 && Math.round(x) <= this.pX2); }
        pContainsY(y) { return (Math.round(y) >= this.pY1 && Math.round(y) <= this.pY2); }
        pContainsRectangle(rectangle) { return this.pContainsPoint([rectangle[0], rectangle[1]]) && this.pContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
        pIntersectsRectangle(rectangle) {
            return app.LOUtil._doRectanglesIntersect(this.pToArray(), rectangle);
        }
        pEquals(rectangle) { return this.pX1 === Math.round(rectangle[0]) && this.pY1 === Math.round(rectangle[1]) && this.pWidth === Math.round(rectangle[2]) && this.pHeight === Math.round(rectangle[3]); }
        pMoveTo(point) { this._x1 = Math.round(point[0] * app.pixelsToTwips); this._y1 = Math.round(point[1] * app.pixelsToTwips); }
        pMoveBy(point) { this._x1 += Math.round(point[0] * app.pixelsToTwips); this._y1 += Math.round(point[1] * app.pixelsToTwips); }
        // CSS pixel.
        get cX1() { return Math.round(this._x1 * app.twipsToPixels / app.dpiScale); }
        set cX1(x1) { this._x1 = Math.round(x1 * app.dpiScale * app.pixelsToTwips); }
        get cY1() { return Math.round(this._y1 * app.twipsToPixels / app.dpiScale); }
        set cY1(y1) { this._y1 = Math.round(y1 * app.dpiScale * app.pixelsToTwips); }
        get cX2() { return this.cX1 + this.cWidth; }
        set cX2(x2) { this._width = Math.round(x2 * app.dpiScale * app.pixelsToTwips); }
        get cY2() { return this.cY1 + this.cHeight; }
        set cY2(y2) { this._height = Math.round(y2 * app.dpiScale * app.pixelsToTwips); }
        get cWidth() { return Math.round(this._width * app.twipsToPixels / app.dpiScale); }
        set cWidth(width) { this._width = Math.round(width * app.dpiScale * app.pixelsToTwips); }
        get cHeight() { return Math.round(this._height * app.twipsToPixels / app.dpiScale); }
        set cHeight(height) { this._height = Math.round(height * app.dpiScale * app.pixelsToTwips); }
        get cArea() { return this.cWidth * this.cHeight; }
        get cCenter() { return [(this.cX1 + this.cX2) / 2, (this.cY1 + this.cY2) / 2]; }
        cToArray() { return [this.cX1, this.cY1, this.cWidth, this.cHeight]; }
        // CSS pixel checkers for coordinate match.
        cContainsPoint(point) { return (Math.round(point[0]) >= this.cX1 && Math.round(point[0]) <= this.cX2 && Math.round(point[1]) >= this.cY1 && Math.round(point[1]) <= this.cY2); }
        cContainsX(x) { return (Math.round(x) >= this.cX1 && Math.round(x) <= this.cX2); }
        cContainsY(y) { return (Math.round(y) >= this.cY1 && Math.round(y) <= this.cY2); }
        cContainsRectangle(rectangle) { return this.cContainsPoint([rectangle[0], rectangle[1]]) && this.cContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
        cIntersectsRectangle(rectangle) {
            return app.LOUtil._doRectanglesIntersect(this.cToArray(), rectangle);
        }
        cEquals(rectangle) { return this.cX1 === Math.round(rectangle[0]) && this.cY1 === Math.round(rectangle[this.y1]) && this.cWidth === Math.round(rectangle[2]) && this.cHeight === Math.round(rectangle[3]); }
        cMoveTo(point) { this._x1 = Math.round(point[0] * app.dpiScale * app.pixelsToTwips); this._y1 = Math.round(point[1] * app.dpiScale * app.pixelsToTwips); }
        cMoveBy(point) { this._x1 += Math.round(point[0] * app.dpiScale * app.pixelsToTwips); this._y1 += Math.round(point[1] * app.dpiScale * app.pixelsToTwips); }
        clone() { return new SimpleRectangle(this.x1, this.y1, this.width, this.height, this.part, this.mode); }
        static fromCorePixels(rectangle, part = -1, mode = -1) {
            return new SimpleRectangle(Math.round(rectangle[0] * app.pixelsToTwips), Math.round(rectangle[1] * app.pixelsToTwips), Math.round(rectangle[2] * app.pixelsToTwips), Math.round(rectangle[3] * app.pixelsToTwips), part, mode);
        }
        // View pixel. 1..4 represents the 4 corners of the rectangle: TopLeft, TopRight, BottomLeft, BottomRight respectively.
        get v1X() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewX(new cool.SimplePoint(this.x1, this.y1, this.part, this.mode)) : this.pX1;
        }
        get v1Y() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewY(new cool.SimplePoint(this.x1, this.y1, this.part, this.mode)) : this.pY1;
        }
        get v2X() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewX(new cool.SimplePoint(this.x2, this.y1, this.part, this.mode)) : this.pX2;
        }
        get v2Y() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewY(new cool.SimplePoint(this.x2, this.y1, this.part, this.mode)) : this.pY1;
        }
        get v3X() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewX(new cool.SimplePoint(this.x1, this.y2, this.part, this.mode)) : this.pX1;
        }
        get v3Y() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewY(new cool.SimplePoint(this.x1, this.y2, this.part, this.mode)) : this.pY2;
        }
        get v4X() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewX(new cool.SimplePoint(this.x2, this.y2, this.part, this.mode)) : this.pX2;
        }
        get v4Y() {
            Util.ensureValue(app.activeDocument);
            return app.activeDocument.activeLayout ? app.activeDocument.activeLayout.documentToViewY(new cool.SimplePoint(this.x2, this.y2, this.part, this.mode)) : this.pY2;
        }
    }
    cool.SimpleRectangle = SimpleRectangle;
    /*
        We have rectangle arrays in some places. We mostly combine these arrays in order to shape the border of a selection.
        The merged result is a polygon. See ASCII art below for an example.
    
        Rectangles (2):
        ___________________
        |_________________|______
        |________________________|
    
        ^ Combined result of above rectangles is (a polygon):
        ________________
        |              |_______
        |_____________________|
    
        Give rectangles as array of rectangle arrays (x, y, width, height).
        Converter constant is used to convert the result into CSS pixels/ Core pixels or twips.
        Tolerance is used to determine if the rectangles are in the same row.
    */
    function rectanglesToPolygon(rectangles, converterConstant = 1, tolerance = 5) {
        /*
            Here we can create a geometric function that handles all the edge cases.
            But we don't need to.
            Conditions:
                * If the rectangles are in the same row:
                    * They should have same height.
                    * They can't have spaces between them.
                * This code doesn't take holes in the polygon into account.
            These conditions will ease our work.
            In the future, we can expand our approach if we need to.
        */
        /*
            First, determine the rows.
            Array of array of rectangles.
        */
        const rowArray = [];
        for (let i = 0; i < rectangles.length; i++) {
            const rectangle = rectangles[i];
            let found = false;
            for (let j = 0; j < rowArray.length; j++) {
                const row = rowArray[j];
                if (Math.abs(row[0][1] - rectangle[1]) <= tolerance) {
                    row.push(rectangle);
                    found = true;
                    break;
                }
            }
            if (!found) {
                rowArray.push([rectangle]);
            }
        }
        const finalRows = [];
        // Now we have rows. We will find the leftmost and rightmost points of each row and push them as rectangles.
        for (let i = 0; i < rowArray.length; i++) {
            let leftmost = rowArray[i][0][0];
            let rightmost = rowArray[i][0][0] + rowArray[i][0][2];
            for (let j = 1; j < rowArray[i].length; j++) {
                const rectangle = rowArray[i][j];
                if (rectangle[0] < leftmost) {
                    leftmost = rectangle[0];
                }
                if (rectangle[0] + rectangle[2] > rightmost) {
                    rightmost = rectangle[0] + rectangle[2];
                }
            }
            finalRows.push([leftmost, rowArray[i][0][1], rightmost - leftmost, rowArray[i][0][3]]);
        }
        // Now we need to sort the rows by y.
        for (let i = 0; i < finalRows.length; i++) {
            for (let j = i + 1; j < finalRows.length; j++) {
                if (finalRows[i][1] > finalRows[j][1]) {
                    const temp = finalRows[i];
                    finalRows[i] = finalRows[j];
                    finalRows[j] = temp;
                }
            }
        }
        // Now we need to merge the rows (the polygon).
        const polygon = [];
        for (let i = 0; i < finalRows.length; i++) { // From leftmost to bottom.
            if (i === 0) {
                // Draw top line, then continue from left to bottom.
                polygon.push(finalRows[i][0] + finalRows[i][2]);
                polygon.push(finalRows[i][1]);
                polygon.push(finalRows[i][0]);
                polygon.push(finalRows[i][1]);
                polygon.push(finalRows[i][0]);
                polygon.push(finalRows[i][1] + finalRows[i][3]);
            }
            else {
                if (finalRows[i][0] !== polygon[polygon.length - 2] || finalRows[i][1] !== polygon[polygon.length - 1]) {
                    polygon.push(finalRows[i][0]);
                    polygon.push(finalRows[i][1]);
                }
                polygon.push(finalRows[i][0]);
                polygon.push(finalRows[i][1] + finalRows[i][3]);
            }
            if (i === finalRows.length - 1) {
                // Draw bottom line.
                polygon.push(finalRows[i][0] + finalRows[i][2]);
                polygon.push(finalRows[i][1] + finalRows[i][3]);
            }
        }
        // Now we will draw from rightmost bottom to top.
        for (let i = finalRows.length - 1; i >= 0; i--) {
            if (finalRows[i][0] + finalRows[i][2] !== polygon[polygon.length - 2] || finalRows[i][1] + finalRows[i][3] !== polygon[polygon.length - 1]) {
                polygon.push(finalRows[i][0] + finalRows[i][2]);
                polygon.push(finalRows[i][1] + finalRows[i][3]);
            }
            polygon.push(finalRows[i][0] + finalRows[i][2]);
            polygon.push(finalRows[i][1]);
        }
        // That's it. We should have drawn the polygon.
        if (converterConstant !== 1) {
            for (let i = 0; i < polygon.length; i++) {
                polygon[i] = Math.round(converterConstant * polygon[i]);
            }
        }
        //return [100, 100, 200, 100, 200, 200, 100, 200]; // Test polygon (to see if caller function draws it correctly).;
        return polygon;
    }
    cool.rectanglesToPolygon = rectanglesToPolygon;
})(cool || (cool = {}));

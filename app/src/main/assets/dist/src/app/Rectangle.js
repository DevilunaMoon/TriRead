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
    /**
     * Represents a rectangle object which works with core pixels.
     * x1 and y1 should always <= x2 and y2. In other words width >= 0 && height >= 0 is a precondition.
     * This class doesn't check for above conditions. There is a isValid function for use when needed.
     */
    class Rectangle {
        constructor(x, y, width, height) {
            this.x1 = x;
            this.y1 = y;
            this.width = width;
            this.height = height;
        }
        // convenience private getters
        get x2() {
            return this.x1 + this.width;
        }
        get y2() {
            return this.y1 + this.height;
        }
        get area() {
            return this.width * this.height;
        }
        // Rounded coordinates private getters
        get rx1() {
            return Math.round(this.x1);
        }
        get ry1() {
            return Math.round(this.y1);
        }
        get rx2() {
            return Math.round(this.x2);
        }
        get ry2() {
            return Math.round(this.y2);
        }
        get rwidth() {
            return this.rx2 - this.rx1;
        }
        get rheight() {
            return this.ry2 - this.ry1;
        }
        get rarea() {
            return this.rwidth * this.rheight;
        }
        isValid() {
            if (this.x1 <= this.x2 && this.y1 <= this.y2)
                return true;
            return false;
        }
        clone() {
            return new Rectangle(this.x1, this.x2, this.width, this.height);
        }
        containsPoint(x, y) {
            if (x >= this.x1 && x <= this.x2 && y >= this.y1 && y <= this.y2)
                return true;
            return false;
        }
        containsPixel(px, py) {
            if (px >= this.rx1 && px <= this.rx2 && py >= this.ry1 && py <= this.ry2)
                return true;
            return false;
        }
        containsXOrdinate(ox) {
            if (ox >= this.x1 && ox <= this.x2)
                return true;
            return false;
        }
        containsYOrdinate(oy) {
            if (oy >= this.y1 && oy <= this.y2)
                return true;
            return false;
        }
        containsPixelOrdinateX(ox) {
            if (ox >= this.rx1 && ox <= this.rx2)
                return true;
            return false;
        }
        containsPixelOrdinateY(oy) {
            if (oy >= this.ry1 && oy <= this.ry2)
                return true;
            return false;
        }
        /// Sets x1 of the rectangle without changing x2.
        setX1(x1) {
            this.width += this.x1 - x1;
            this.x1 = x1;
        }
        /// Sets x2 of the rectangle without changing x1.
        setX2(x2) {
            this.width = x2 - this.x1;
        }
        /// Sets y1 of the rectangle without changing y2.
        setY1(y1) {
            this.height += this.y1 - y1;
            this.y1 = y1;
        }
        /// Sets y2 of the rectangle without changing y1.
        setY2(y2) {
            this.height = y2 - this.y1;
        }
        /// Sets width keeping x1 constant.
        setWidth(width) {
            this.width = width;
        }
        /// Sets height keeping y1 constant.
        setHeight(height) {
            this.height = height;
        }
        /// Sets area by either keeping height or width as constant.
        setArea(area, preserveHeight) {
            if (!preserveHeight) {
                //preserve width
                const height = area / this.width;
                this.setHeight(height);
            }
            else {
                // preserve height
                const width = area / this.height;
                this.setWidth(width);
            }
        }
        /// Moves the whole rectangle by (dx, dy) by preserving width and height.
        moveBy(dx, dy) {
            this.x1 += dx;
            this.y1 += dy;
        }
        /**
         * Moves the rectangle to (x, y) as its new x1, y1 without changing
         * its size.
         */
        moveTo(x, y) {
            this.x1 = x;
            this.y1 = y;
        }
        // TODO: Following methods could be replaced with js getters
        // but we need to change their users to access getters.
        getX1() {
            return this.x1;
        }
        getX2() {
            return this.x2;
        }
        getY1() {
            return this.y1;
        }
        getY2() {
            return this.y2;
        }
        getWidth() {
            return this.width;
        }
        getHeight() {
            return this.height;
        }
        getArea() {
            return this.area;
        }
        getCenter() {
            return [(this.x2 + this.x1) / 2, (this.y2 + this.y1) / 2];
        }
        getPxX1() {
            return this.rx1;
        }
        getPxX2() {
            return this.rx2;
        }
        getPxY1() {
            return this.ry1;
        }
        getPxY2() {
            return this.ry2;
        }
        getPxWidth() {
            return this.rwidth;
        }
        getPxHeight() {
            return this.rheight;
        }
        getPxArea() {
            return this.rarea;
        }
        getPxCenter() {
            return [
                Math.round((this.rx2 + this.rx1) / 2),
                Math.round((this.ry2 + this.ry1) / 2),
            ];
        }
    }
    cool.Rectangle = Rectangle;
    function createRectangle(x, y, width, height) {
        return new Rectangle(x, y, width, height);
    }
    cool.createRectangle = createRectangle;
})(cool || (cool = {}));

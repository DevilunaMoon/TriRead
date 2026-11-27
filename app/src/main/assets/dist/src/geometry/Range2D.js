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
    /// An axis-aligned rectangle in twips, held as its two corners. A
    /// range never changes once made.
    class Range2D {
        constructor(minX, minY, maxX, maxY) {
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }
        /// From the four values [minX, minY, maxX, maxY]. Null when there
        /// are fewer than four.
        static fromArray(values) {
            if (!values || values.length < 4)
                return null;
            return new Range2D(values[0], values[1], values[2], values[3]);
        }
        get width() {
            return this.maxX - this.minX;
        }
        get height() {
            return this.maxY - this.minY;
        }
        get centerX() {
            return (this.minX + this.maxX) / 2;
        }
        get centerY() {
            return (this.minY + this.maxY) / 2;
        }
        /// The smallest range that holds all the points, which must be at least one.
        static fromPoints(points) {
            return new Range2D(Math.min(...points.map((point) => point.x)), Math.min(...points.map((point) => point.y)), Math.max(...points.map((point) => point.x)), Math.max(...points.map((point) => point.y)));
        }
        /// The range grown by that much on the left and the right, and on the top and the bottom.
        expand(across, down) {
            return new Range2D(this.minX - across, this.minY - down, this.maxX + across, this.maxY + down);
        }
        /// The point inside the range that is nearest to the one given: itself where it lies inside,
        /// and on the edge where it lies outside.
        clamp(point) {
            return new cool.Point(Math.min(Math.max(point.x, this.minX), this.maxX), Math.min(Math.max(point.y, this.minY), this.maxY));
        }
        /// The smallest range that holds both this one and the other.
        union(other) {
            return new Range2D(Math.min(this.minX, other.minX), Math.min(this.minY, other.minY), Math.max(this.maxX, other.maxX), Math.max(this.maxY, other.maxY));
        }
        /// The smallest range that holds the four corners of this one, each put through the mapping.
        /// A mapping that turns or shears the range gives a larger range than the one put in.
        transform(mapping) {
            return Range2D.fromPoints([
                mapping.apply(this.minX, this.minY),
                mapping.apply(this.maxX, this.minY),
                mapping.apply(this.maxX, this.maxY),
                mapping.apply(this.minX, this.maxY),
            ]);
        }
        /// True when the range covers no area, including when a corner is
        /// not a number.
        isEmpty() {
            return !(this.maxX > this.minX) || !(this.maxY > this.minY);
        }
        toArray() {
            return [this.minX, this.minY, this.maxX, this.maxY];
        }
    }
    cool.Range2D = Range2D;
})(cool || (cool = {}));

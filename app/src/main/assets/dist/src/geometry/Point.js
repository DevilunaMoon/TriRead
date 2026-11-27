// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
/* global L */
var cool;
(function (cool) {
    /// Point represents a point with x and y coordinates.
    class Point {
        constructor(x, y, round = false) {
            this.x = (round ? Math.round(x) : x);
            this.y = (round ? Math.round(y) : y);
        }
        static parse(pointString) {
            if (typeof pointString !== 'string') {
                console.error('invalid point string');
                return undefined;
            }
            var pointParts = pointString.match(/-?\d+/g);
            if (pointParts === null || pointParts.length < 2) {
                console.error('incomplete point');
                return undefined;
            }
            return new Point(parseInt(pointParts[0]), parseInt(pointParts[1]));
        }
        clone() {
            return new Point(this.x, this.y);
        }
        /// non-destructive, returns a new point
        add(point) {
            return this.clone()._add(Point.toPoint(point));
        }
        // destructive, used directly for performance in situations where it's safe to modify existing point
        _add(point) {
            this.x += point.x;
            this.y += point.y;
            return this;
        }
        subtract(point) {
            return this.clone()._subtract(Point.toPoint(point));
        }
        _subtract(point) {
            this.x -= point.x;
            this.y -= point.y;
            return this;
        }
        divideBy(num) {
            return this.clone()._divideBy(num);
        }
        _divideBy(num) {
            this.x /= num;
            this.y /= num;
            return this;
        }
        multiplyBy(num) {
            return this.clone()._multiplyBy(num);
        }
        _multiplyBy(num) {
            this.x *= num;
            this.y *= num;
            return this;
        }
        round() {
            return this.clone()._round();
        }
        _round() {
            this.x = Math.round(this.x);
            this.y = Math.round(this.y);
            return this;
        }
        floor() {
            return this.clone()._floor();
        }
        _floor() {
            this.x = Math.floor(this.x);
            this.y = Math.floor(this.y);
            return this;
        }
        ceil() {
            return this.clone()._ceil();
        }
        _ceil() {
            this.x = Math.ceil(this.x);
            this.y = Math.ceil(this.y);
            return this;
        }
        /// How far the point lies from the origin, which for a direction is its length.
        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }
        /// The cross product with the other one: positive where the other lies on the side the y axis
        /// turns to from this one, negative on the other side, zero where both lie on one line.
        cross(point) {
            return this.x * point.y - this.y * point.x;
        }
        /// The dot product with the other one: how far this one reaches along the other, times the
        /// length of the other.
        dot(point) {
            return this.x * point.x + this.y * point.y;
        }
        distanceTo(point) {
            point = Point.toPoint(point);
            var x = point.x - this.x;
            var y = point.y - this.y;
            return Math.sqrt(x * x + y * y);
        }
        equals(point) {
            point = Point.toPoint(point);
            // Proper ieee 754 equality comparison.
            return Math.abs(point.x - this.x) < Number.EPSILON &&
                Math.abs(point.y - this.y) < Number.EPSILON;
        }
        contains(point) {
            point = Point.toPoint(point);
            return Math.abs(point.x) <= Math.abs(this.x) &&
                Math.abs(point.y) <= Math.abs(this.y);
        }
        assign(point) {
            var xChanged = this.setX(point.x);
            var yChanged = this.setY(point.y);
            return xChanged || yChanged;
        }
        setX(x) {
            if (x === this.x) {
                return false;
            }
            this.x = x;
            return true;
        }
        setY(y) {
            if (y === this.y) {
                return false;
            }
            this.y = y;
            return true;
        }
        toString() {
            return 'Point(' +
                Point.formatNum(this.x) + ', ' +
                Point.formatNum(this.y) + ')';
        }
        static toPoint(x, y, round) {
            if (x instanceof Point) {
                return x;
            }
            if (x instanceof cool.SimplePoint) {
                return new Point(x.x, x.y);
            }
            if (Array.isArray(x)) {
                var arr = x;
                return new Point(arr[0], arr[1]);
            }
            if (x === undefined || x === null) {
                return undefined;
            }
            // Detect cool.Point like objects such as CPoint.
            if (Object.prototype.hasOwnProperty.call(x, 'x')
                && Object.prototype.hasOwnProperty.call(x, 'y')) {
                x = x;
                return new Point(x.x, x.y);
            }
            x = x;
            return new Point(x, y, round);
        }
        static formatNum(num) {
            var pow = Math.pow(10, 5);
            return Math.round(num * pow) / pow;
        }
    }
    cool.Point = Point;
})(cool || (cool = {}));

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
    /** Tells whether a point hits what a JSON primitive tree paints.
     *
     * Each type of primitive is answered the way the document engine answers it: an outline is hit
     * along its line, a filled polygon anywhere inside it or within the tolerance of its edge, a
     * stroke within half its width, a text and a bitmap inside the area they cover, and a group
     * wherever one of its children is hit. A clip is a gate: what it holds can only be hit inside
     * it. A shadow is never hit.
     */
    class VectorHitTest {
        /*
            The tests ask the browser whether a point lies in a path, which needs a drawing context
            but no drawing surface, so one context is kept for all of them. It also measures text,
            whose extent decides the area a text portion covers.
        */
        static { this._context = undefined; }
        static context() {
            if (VectorHitTest._context === undefined)
                VectorHitTest._context = document
                    .createElement('canvas')
                    .getContext('2d');
            return VectorHitTest._context;
        }
        /** What the point hits among the primitives, or nothing when it hits none of them.
         *
         * The primitives are in the order they are painted, and the answer is the last of them
         * that is hit, so what lies on top of everything else is what answers. Primitives that
         * paint over the whole object are tested against the range, the area the object covers.
         */
        static hit(primitives, position, range, walk = VectorHitTest.wholeOf()) {
            if (!primitives)
                return undefined;
            let result = undefined;
            primitives.forEach((primitive) => {
                const hit = VectorHitTest.hitPrimitive(primitive, position, range, walk);
                if (hit)
                    result = hit;
            });
            return result;
        }
        /// Whether the point hits any of the primitives.
        static isHit(primitives, position, range) {
            return VectorHitTest.hit(primitives, position, range) !== undefined;
        }
        /** Whether the point lies in the unit square put through the matrix.
         *
         * This is the shape of an object as its own transformation describes it, so it carries the
         * rotation and the shear that an upright rectangle around the object cannot. What an object
         * paints beyond that square, a wide outline or a shadow, lies outside it.
         */
        static isInUnitSquare(matrix, position) {
            if (!matrix)
                return false;
            return (VectorHitTest.hitFill(VectorHitTest.pathOfUnitSquare(matrix), position) !== undefined);
        }
        /** Whether the point hits the text of the primitives, and nothing else of them.
         *
         * The tolerance is what decides how far from the glyphs still counts, per axis, so a
         * caller that asks about a line of text gives a wide reach along the line and none across
         * it. The document engine asks the same question, with the same per-axis tolerance, to
         * decide whether a click would go into the text of a shape.
         */
        static isHitText(primitives, position) {
            return (VectorHitTest.hit(primitives, position, undefined, {
                ...VectorHitTest.wholeOf(),
                textOnly: true,
            }) !== undefined);
        }
        static hitPrimitive(primitive, position, range, walk = VectorHitTest.wholeOf()) {
            if (!primitive || !primitive.type)
                return undefined;
            const fields = primitive;
            switch (primitive.type) {
                case cool.TextSimplePortionPrimitive.type:
                case cool.TextDecoratedPortionPrimitive.type:
                    return VectorHitTest.result('text', walk, VectorHitTest.isInText(primitive, position));
                case cool.TransformPrimitive.type:
                case cool.ReflectionPrimitive.type:
                    // A reflection is hit where its mirrored children are.
                    return VectorHitTest.hit(primitive.children, VectorHitTest.positionThrough(position, cool.Matrix2D.fromArray(fields.matrix)), range, {
                        ...walk,
                        matrix: VectorHitTest.matrixThrough(walk.matrix, fields.matrix),
                    });
                case cool.MaskPrimitive.type:
                    // The clip decides whether anything inside it can be reached at all.
                    if (fields.clip &&
                        VectorHitTest.hitFill(new Path2D(fields.clip), position) ===
                            undefined)
                        return undefined;
                    return VectorHitTest.hit(primitive.children, position, range, walk);
                case cool.HiddenGeometryPrimitive.type:
                    // What this holds is there to be hit, so it answers, and says so.
                    return VectorHitTest.hit(primitive.children, position, range, {
                        ...walk,
                        hidden: true,
                    });
                case cool.ExclusiveEditViewPrimitive.type:
                    return VectorHitTest.hit(primitive.children, position, range, {
                        ...walk,
                        editView: true,
                    });
                case cool.PolygonHairlinePrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    const line = VectorHitTest.pathOf(fields.path);
                    return VectorHitTest.result('line', walk, VectorHitTest.isAlongStrokedPath(line, position, 0), line);
                }
                case cool.PolygonStrokePrimitive.type:
                case cool.PolyPolygonStrokePrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    // A line is hit within half its width, which a hairline does not have.
                    const stroke = VectorHitTest.pathOf(fields.path);
                    return VectorHitTest.result('line', walk, VectorHitTest.isAlongStrokedPath(stroke, position, fields.line?.width ?? 0, fields.line), stroke);
                }
                case cool.SingleLinePrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    const line = fields;
                    const path = new Path2D();
                    path.moveTo(line.startX ?? 0, line.startY ?? 0);
                    path.lineTo(line.endX ?? 0, line.endY ?? 0);
                    return VectorHitTest.result('line', walk, VectorHitTest.isAlongStrokedPath(path, position, 0), path);
                }
                case cool.LineRectanglePrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    // An outlined rectangle is hit along its outline, not inside it.
                    const outline = VectorHitTest.pathOfRange(cool.Range2D.fromArray(fields.bounds));
                    return VectorHitTest.result('line', walk, VectorHitTest.isAlongStrokedPath(outline, position, 0), outline);
                }
                case cool.PolyPolygonColorPrimitive.type:
                case cool.PolyPolygonRGBAPrimitive.type:
                case 'polyPolygonGradient':
                case 'polyPolygonAlphaGradient':
                case 'polyPolygonHatch':
                case 'polyPolygonGraphic':
                case 'patternFill': {
                    if (walk.textOnly)
                        return undefined;
                    const fill = VectorHitTest.pathOf(fields.path);
                    return VectorHitTest.fillResult(walk, VectorHitTest.hitFill(fill, position), fill);
                }
                case cool.FilledRectanglePrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    const area = VectorHitTest.pathOfRange(cool.Range2D.fromArray(fields.bounds));
                    return VectorHitTest.fillResult(walk, VectorHitTest.hitFill(area, position), area);
                }
                case 'fillGradient':
                case 'fillHatch':
                case 'fillGraphic': {
                    if (walk.textOnly)
                        return undefined;
                    const covered = VectorHitTest.pathOfRange(cool.Range2D.fromArray(fields.outputRange)) ??
                        VectorHitTest.pathOfUnitSquare(cool.Matrix2D.fromArray(fields.matrix));
                    return VectorHitTest.fillResult(walk, VectorHitTest.hitFill(covered, position), covered);
                }
                case cool.BackgroundColorPrimitive.type: {
                    if (walk.textOnly)
                        return undefined;
                    // The range is in the coordinates the walk was asked in, the point in those
                    // of the children, so the range comes down through the inverse of the walk.
                    const down = walk.matrix.invert();
                    if (!down)
                        return undefined;
                    const whole = VectorHitTest.pathThrough(VectorHitTest.pathOfRange(range), down);
                    return VectorHitTest.fillResult(walk, VectorHitTest.hitFill(whole, position), whole);
                }
                case cool.BitmapPrimitive.type:
                case cool.BitmapAlphaPrimitive.type:
                case cool.GraphicPrimitive.type:
                case cool.FormControlPrimitive.type: {
                    /*
                        An image is hit anywhere inside the area it covers, see-through pixels
                        included, as the engine does while it serves a client.
                    */
                    if (fields.matrix) {
                        if (walk.textOnly)
                            return undefined;
                        const image = VectorHitTest.pathOfUnitSquare(cool.Matrix2D.fromArray(fields.matrix));
                        return VectorHitTest.result('bitmap', walk, VectorHitTest.hitFill(image, position) !== undefined, image);
                    }
                    // A vector graphic paints through its children instead.
                    return VectorHitTest.hit(primitive.children, position, range, walk);
                }
                case cool.PointArrayPrimitive.type:
                    if (walk.textOnly)
                        return undefined;
                    return VectorHitTest.result('point', walk, VectorHitTest.isAtPoint(primitive, position));
                case 'shadow':
                    // A shadow cannot be hit.
                    return undefined;
                case cool.TextHierarchyFieldPrimitive.type:
                    // The text of a hyperlink field answers as a link.
                    return VectorHitTest.hit(primitive.children, position, range, {
                        ...walk,
                        link: walk.link ||
                            primitive.fieldType === 'url',
                    });
                default:
                    /*
                        Everything else is painted by what it holds: the containers, the text
                        hierarchy, and the groups that only change how their children look.
                    */
                    return VectorHitTest.hit(primitive.children, position, range, walk);
            }
        }
        /*
            The outline of what the primitives draw as geometry, in the coordinates they are written
            in: the boundary of every fill and the course of every line, through the transforms
            they hang under. Text is left out, so the outline of a shape is not that of the letters
            in it, and so are shadows and the background that covers the whole object. A fill
            inside a mask, a gradient or a picture filling a shape, is outlined by the mask, which
            is what gives it its shape. Nothing where the primitives draw no geometry.
        */
        static outlineOf(primitives) {
            const outline = new Path2D();
            let anything = false;
            const add = (path, matrix) => {
                if (!path)
                    return;
                outline.addPath(path, {
                    a: matrix.a,
                    b: matrix.b,
                    c: matrix.c,
                    d: matrix.d,
                    e: matrix.e,
                    f: matrix.f,
                });
                anything = true;
            };
            const walk = (list, matrix) => {
                for (const primitive of list ?? []) {
                    const fields = primitive;
                    switch (primitive.type) {
                        case cool.TextSimplePortionPrimitive.type:
                        case cool.TextDecoratedPortionPrimitive.type:
                        case cool.BackgroundColorPrimitive.type:
                        case cool.PointArrayPrimitive.type:
                        case 'shadow':
                            break;
                        case cool.TransformPrimitive.type:
                        case cool.ReflectionPrimitive.type:
                            walk(primitive.children, VectorHitTest.matrixThrough(matrix, fields.matrix));
                            break;
                        case cool.MaskPrimitive.type:
                            if (fields.clip)
                                add(new Path2D(fields.clip), matrix);
                            else
                                walk(primitive.children, matrix);
                            break;
                        case cool.PolygonHairlinePrimitive.type:
                        case cool.PolygonStrokePrimitive.type:
                        case cool.PolyPolygonStrokePrimitive.type:
                        case cool.PolyPolygonColorPrimitive.type:
                        case cool.PolyPolygonRGBAPrimitive.type:
                        case 'polyPolygonGradient':
                        case 'polyPolygonAlphaGradient':
                        case 'polyPolygonHatch':
                        case 'polyPolygonGraphic':
                        case 'patternFill':
                            add(VectorHitTest.pathOf(fields.path), matrix);
                            break;
                        case cool.SingleLinePrimitive.type: {
                            const line = fields;
                            const path = new Path2D();
                            path.moveTo(line.startX ?? 0, line.startY ?? 0);
                            path.lineTo(line.endX ?? 0, line.endY ?? 0);
                            add(path, matrix);
                            break;
                        }
                        case cool.LineRectanglePrimitive.type:
                        case cool.FilledRectanglePrimitive.type:
                            add(VectorHitTest.pathOfRange(cool.Range2D.fromArray(fields.bounds)), matrix);
                            break;
                        case 'fillGradient':
                        case 'fillHatch':
                        case 'fillGraphic':
                            add(VectorHitTest.pathOfRange(cool.Range2D.fromArray(fields.outputRange)) ??
                                VectorHitTest.pathOfUnitSquare(cool.Matrix2D.fromArray(fields.matrix)), matrix);
                            break;
                        case cool.BitmapPrimitive.type:
                        case cool.BitmapAlphaPrimitive.type:
                        case cool.GraphicPrimitive.type:
                            if (fields.matrix)
                                add(VectorHitTest.pathOfUnitSquare(cool.Matrix2D.fromArray(fields.matrix)), matrix);
                            else
                                walk(primitive.children, matrix);
                            break;
                        default:
                            walk(primitive.children, matrix);
                    }
                }
            };
            walk(primitives, cool.Matrix2D.IDENTITY);
            return anything ? outline : undefined;
        }
        static result(kind, walk, hit, path) {
            if (!hit)
                return undefined;
            return {
                kind: kind,
                hidden: walk.hidden,
                editView: walk.editView,
                edge: false,
                link: kind === 'text' && walk.link,
                path: VectorHitTest.pathThrough(path, walk.matrix),
            };
        }
        static fillResult(walk, where, path) {
            if (!where)
                return undefined;
            return {
                kind: 'fill',
                hidden: walk.hidden,
                editView: walk.editView,
                edge: where === 'edge',
                link: false,
                path: VectorHitTest.pathThrough(path, walk.matrix),
            };
        }
        /// A walk that asks about everything, in the coordinates the primitives are written in.
        static wholeOf() {
            return {
                textOnly: false,
                hidden: false,
                editView: false,
                link: false,
                matrix: cool.Matrix2D.IDENTITY,
            };
        }
        /// The two matrices as one: what maps a child onto what the walk was asked in.
        static matrixThrough(parent, child) {
            const own = cool.Matrix2D.fromArray(child);
            return own ? own.then(parent) : parent;
        }
        /// The path in the coordinates the walk was asked in.
        static pathThrough(path, matrix) {
            if (!path)
                return undefined;
            const mapped = new Path2D();
            mapped.addPath(path, {
                a: matrix.a,
                b: matrix.b,
                c: matrix.c,
                d: matrix.d,
                e: matrix.e,
                f: matrix.f,
            });
            return mapped;
        }
        /// The position and the tolerance in the coordinates a child of the matrix is written in.
        static positionThrough(position, matrix) {
            // The point goes the other way through the matrix, which is cheaper than putting the
            // geometry of every child through it. The tolerance is a distance, so it goes through
            // the part that turns and scales only, as the upright box around the tolerance box
            // put through it: each term counts by its size, so a turn widens the reach on both
            // axes rather than letting the two parts of one axis take each other away.
            const back = matrix?.invert();
            if (!back)
                return position;
            const at = back.apply(position.x, position.y);
            return {
                x: at.x,
                y: at.y,
                toleranceX: Math.abs(back.a) * position.toleranceX +
                    Math.abs(back.c) * position.toleranceY,
                toleranceY: Math.abs(back.b) * position.toleranceX +
                    Math.abs(back.d) * position.toleranceY,
            };
        }
        static tolerance(position) {
            return Math.max(position.toleranceX, position.toleranceY);
        }
        static pathOfRange(range) {
            if (!range)
                return undefined;
            const path = new Path2D();
            path.rect(range.minX, range.minY, range.width, range.height);
            return path;
        }
        /** The four corners of the unit square put through the matrix.
         *
         * It is the area an image covers, and the shape of an object as its own transformation
         * describes it.
         */
        static pathOfUnitSquare(matrix) {
            if (!matrix)
                return undefined;
            const path = new Path2D();
            [
                matrix.apply(0, 0),
                matrix.apply(1, 0),
                matrix.apply(1, 1),
                matrix.apply(0, 1),
            ].forEach((corner, at) => at ? path.lineTo(corner.x, corner.y) : path.moveTo(corner.x, corner.y));
            path.closePath();
            return path;
        }
        /// Where the point lies in a filled path: inside it, within the tolerance of its
        /// boundary, or neither. The engine fills with the even-odd rule, so a subpath inside
        /// another subpath is a hole there as well.
        static hitFill(path, position) {
            const context = VectorHitTest.context();
            if (!path || !context)
                return undefined;
            if (context.isPointInPath(path, position.x, position.y, 'evenodd'))
                return 'inside';
            return VectorHitTest.isAlongStrokedPath(path, position, 0)
                ? 'edge'
                : undefined;
        }
        static pathOf(path) {
            return path ? new Path2D(path) : undefined;
        }
        /// Within half the line width of the path, plus the tolerance. The joins and caps are the
        /// ones the line is drawn with, so a mitered corner reaches as far as it is painted.
        static isAlongStrokedPath(path, position, width, line) {
            const context = VectorHitTest.context();
            if (!path || !context)
                return false;
            const reach = width + 2 * VectorHitTest.tolerance(position);
            if (!(reach > 0))
                return false;
            context.save();
            context.lineWidth = reach;
            context.lineJoin =
                line?.linejoin === 'round' || line?.linejoin === 'bevel'
                    ? line.linejoin
                    : 'miter';
            context.lineCap =
                line?.linecap === 'round' || line?.linecap === 'square'
                    ? line.linecap
                    : 'butt';
            const hit = context.isPointInStroke(path, position.x, position.y);
            context.restore();
            return hit;
        }
        /// A text is hit inside the area its glyphs occupy, measured for the font the portion
        /// names, the way the engine uses the area a text portion covers.
        static isInText(primitive, position) {
            const context = VectorHitTest.context();
            if (!context || !primitive.text)
                return false;
            const start = primitive.textPosition ?? 0;
            const length = primitive.textLength ?? primitive.text.length - start;
            const text = primitive.text.substring(start, start + length);
            if (!text)
                return false;
            const fontSize = primitive.fontSize ?? 0;
            if (!(fontSize > 0))
                return false;
            const glyphs = cool.Matrix2D.fromArray(primitive.matrix) ??
                cool.Matrix2D.IDENTITY.scale(fontSize, fontSize);
            /*
                The matrix carries the font size in its scale, so dividing it out leaves what
                rotates, shears and flips the glyphs. The point goes the other way through that,
                which puts it where the glyphs sit on their baseline.
            */
            const local = VectorHitTest.positionThrough(position, new cool.Matrix2D(glyphs.a / fontSize, glyphs.b / fontSize, glyphs.c / fontSize, glyphs.d / fontSize, glyphs.e, glyphs.f));
            context.font = `${primitive.italic ? 'italic' : 'normal'} ${fontSize}px "${primitive.familyname ?? 'sans-serif'}"`;
            const metrics = context.measureText(text);
            const width = metrics.width;
            // A font that does not report where it reaches above and below the baseline is taken to
            // fill its own size.
            const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
            const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
            /*
                The box the glyphs occupy, reached from as far as the tolerance says on each axis.
                A reader that asks about a whole line of text gives a wide reach along the line and
                none across it, so a point past the end of a short line still counts as that line
                and a point above it does not.
            */
            const box = VectorHitTest.pathOfRange(new cool.Range2D(-local.toleranceX, -ascent - local.toleranceY, width + local.toleranceX, descent + local.toleranceY));
            return (VectorHitTest.hitFill(box, {
                x: local.x,
                y: local.y,
                toleranceX: 0,
                toleranceY: 0,
            }) !== undefined);
        }
        static isAtPoint(primitive, position) {
            if (!primitive.points)
                return false;
            const reach = VectorHitTest.tolerance(position);
            return primitive.points.some((point) => Math.hypot(point.x - position.x, point.y - position.y) <= reach);
        }
    }
    cool.VectorHitTest = VectorHitTest;
})(cool || (cool = {}));

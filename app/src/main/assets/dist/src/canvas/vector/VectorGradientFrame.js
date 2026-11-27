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
    /// Follows the same construction the engine uses, so a ramp lands
    /// where the engine's own rendering puts it.
    let VectorGradientFrame;
    (function (VectorGradientFrame) {
        function extentOf(range) {
            return {
                sizeX: range.width,
                sizeY: range.height,
                offsetX: range.minX,
                offsetY: range.minY,
            };
        }
        /// Resize the extent around its center.
        function resize(extent, sizeX, sizeY) {
            extent.offsetX -= (sizeX - extent.sizeX) / 2;
            extent.offsetY -= (sizeY - extent.sizeY) / 2;
            extent.sizeX = sizeX;
            extent.sizeY = sizeY;
        }
        /// Grow the extent so it still covers its starting area once it is
        /// turned by the angle.
        function growForRotation(extent, angle) {
            const absoluteCosine = Math.abs(Math.cos(angle));
            const absoluteSine = Math.abs(Math.sin(angle));
            resize(extent, extent.sizeX * absoluteCosine + extent.sizeY * absoluteSine, extent.sizeY * absoluteCosine + extent.sizeX * absoluteSine);
        }
        function frameOf(matrix, extent) {
            return {
                matrix: matrix,
                aspectRatio: extent.sizeY === 0 ? 1 : extent.sizeX / extent.sizeY,
            };
        }
        /// Both run along y and are widened to keep covering the range
        /// once rotated.
        function oneDimensional(range, angle, border, axial) {
            angle = -angle;
            const extent = extentOf(range);
            const rotated = angle !== 0;
            if (rotated)
                growForRotation(extent, angle);
            const withoutBorder = 1 - border;
            let matrix = cool.Matrix2D.IDENTITY;
            if (axial) {
                matrix = matrix.scale(1, withoutBorder * 0.5).translate(0, 0.5);
            }
            else if (withoutBorder !== 1) {
                matrix = matrix.scale(1, withoutBorder).translate(0, border);
            }
            matrix = matrix.scale(extent.sizeX, extent.sizeY);
            if (rotated)
                matrix = matrix.rotateAround(0.5 * extent.sizeX, 0.5 * extent.sizeY, angle);
            matrix = matrix.translate(extent.offsetX, extent.offsetY);
            return frameOf(matrix, extent);
        }
        /// A ramp running outwards from the center of the extent, with the
        /// border held back and the center moved by the offsets, which are
        /// fractions of the range as it was given.
        function centered(range, extent, angle, border, centerOffsetX, centerOffsetY) {
            const halfBorder = (1 - border) * 0.5;
            let matrix = cool.Matrix2D.IDENTITY.scale(halfBorder, halfBorder)
                .translate(0.5, 0.5)
                .scale(extent.sizeX, extent.sizeY);
            if (angle !== 0)
                matrix = matrix.rotateAround(0.5 * extent.sizeX, 0.5 * extent.sizeY, angle);
            const offsetX = extent.offsetX + (centerOffsetX - 0.5) * range.width;
            const offsetY = extent.offsetY + (centerOffsetY - 0.5) * range.height;
            matrix = matrix.translate(offsetX, offsetY);
            return frameOf(matrix, extent);
        }
        /// The circular one grows the range to its diagonal so the ring
        /// reaches the corners and ignores the angle.
        function elliptical(range, angle, border, centerOffsetX, centerOffsetY, circular) {
            const extent = extentOf(range);
            if (circular) {
                const diagonal = Math.hypot(extent.sizeX, extent.sizeY);
                resize(extent, diagonal, diagonal);
            }
            else {
                resize(extent, Math.SQRT2 * extent.sizeX, Math.SQRT2 * extent.sizeY);
            }
            return centered(range, extent, circular ? 0 : -angle, border, centerOffsetX, centerOffsetY);
        }
        /// The square one takes the longer side of the range for both
        /// axes and keeps that box whatever the angle, so the turned
        /// ramp reaches past the range at the corners. The rect one
        /// keeps the range and is widened to cover it once turned.
        function boxed(range, angle, border, centerOffsetX, centerOffsetY, square) {
            angle = -angle;
            const extent = extentOf(range);
            if (square) {
                const side = Math.max(extent.sizeX, extent.sizeY);
                resize(extent, side, side);
            }
            else if (angle !== 0) {
                growForRotation(extent, angle);
            }
            return centered(range, extent, angle, border, centerOffsetX, centerOffsetY);
        }
        /// Null when the range has no area to lay a ramp out on.
        function create(gradient, range) {
            if (!range || range.isEmpty())
                return null;
            // The ramp turns by an angle given in degrees, and the
            // frame is built with sines and cosines of radians.
            const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
            const border = gradient.border ?? 0;
            const centerX = gradient.offsetX ?? 0.5;
            const centerY = gradient.offsetY ?? 0.5;
            switch (gradient.style) {
                case 'axial':
                    return oneDimensional(range, angle, border, true);
                case 'radial':
                    return elliptical(range, angle, border, centerX, centerY, true);
                case 'elliptical':
                    return elliptical(range, angle, border, centerX, centerY, false);
                case 'square':
                    return boxed(range, angle, border, centerX, centerY, true);
                case 'rect':
                    return boxed(range, angle, border, centerX, centerY, false);
                default:
                    return oneDimensional(range, angle, border, false);
            }
        }
        VectorGradientFrame.create = create;
    })(VectorGradientFrame = cool.VectorGradientFrame || (cool.VectorGradientFrame = {}));
})(cool || (cool = {}));

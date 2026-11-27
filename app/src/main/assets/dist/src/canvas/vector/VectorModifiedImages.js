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
    /// Decoded images with their colors changed pixel by pixel, at about the
    /// drawn size, in a byte budget that drops the least recently drawn. A
    /// raster copy is at most the image size. An SVG copy goes up to a limit.
    class VectorModifiedImages {
        // A quarter extra size, so a small zoom in reuses the copy.
        static { this._HEADROOM = 1.25; }
        // The most pixels across an SVG copy has.
        static { this._MAX_SVG_SIZE = 4096; }
        /// The budget is in bytes, at four bytes per pixel.
        constructor(budget = 64 * 1024 * 1024) {
            this._imageIds = new WeakMap();
            this._nextImageId = 0;
            // By image and list of modifiers, the copy drawn longest ago first.
            this._copies = new Map();
            this._bytes = 0;
            this._budget = budget;
        }
        /// The modified image, at least width by height where the image is that
        /// large. The image itself when no canvas is available.
        get(image, modifiers, width, height) {
            if (!(image.naturalWidth > 0 && image.naturalHeight > 0))
                return image;
            const svg = VectorModifiedImages._isSvg(image);
            const maxWidth = svg
                ? VectorModifiedImages._MAX_SVG_SIZE
                : image.naturalWidth;
            const maxHeight = svg
                ? VectorModifiedImages._MAX_SVG_SIZE
                : image.naturalHeight;
            const neededWidth = Math.min(maxWidth, Math.max(1, Math.ceil(width)));
            const neededHeight = Math.min(maxHeight, Math.max(1, Math.ceil(height)));
            const key = this._imageId(image) + ' ' + JSON.stringify(modifiers);
            const cached = this._copies.get(key);
            if (cached) {
                this._copies.delete(key);
                if (cached.canvas.width >= neededWidth &&
                    cached.canvas.height >= neededHeight) {
                    // Drawn again, so it goes to the end of the queue.
                    this._copies.set(key, cached);
                    return cached.canvas;
                }
                this._free(cached);
            }
            const copyWidth = Math.min(maxWidth, Math.ceil(neededWidth * VectorModifiedImages._HEADROOM));
            const copyHeight = Math.min(maxHeight, Math.ceil(neededHeight * VectorModifiedImages._HEADROOM));
            const canvas = document.createElement('canvas');
            canvas.width = copyWidth;
            canvas.height = copyHeight;
            const copy = canvas.getContext('2d');
            if (!copy)
                return image;
            copy.drawImage(image, 0, 0, copyWidth, copyHeight);
            const pixels = copy.getImageData(0, 0, copyWidth, copyHeight);
            cool.VectorColorModifiers.applyToPixels(pixels.data, modifiers);
            copy.putImageData(pixels, 0, 0);
            const entry = { canvas: canvas, bytes: copyWidth * copyHeight * 4 };
            this._copies.set(key, entry);
            this._bytes += entry.bytes;
            this._keepToBudget(key);
            return canvas;
        }
        /// Drop every copy.
        release() {
            this._copies.forEach((entry) => this._free(entry));
            this._copies.clear();
        }
        // The image data arrives as a data URL with its MIME type.
        static _isSvg(image) {
            return image.src.startsWith('data:image/svg+xml');
        }
        _imageId(image) {
            let id = this._imageIds.get(image);
            if (id === undefined) {
                id = this._nextImageId++;
                this._imageIds.set(image, id);
            }
            return id;
        }
        // Drop the oldest copies to fit the budget, always keeping the newest.
        _keepToBudget(newest) {
            for (const [key, entry] of Array.from(this._copies)) {
                if (this._bytes <= this._budget)
                    return;
                if (key === newest)
                    continue;
                this._copies.delete(key);
                this._free(entry);
            }
        }
        // A zero-size canvas frees its pixels before garbage collection.
        _free(entry) {
            this._bytes -= entry.bytes;
            entry.canvas.width = 0;
            entry.canvas.height = 0;
        }
    }
    cool.VectorModifiedImages = VectorModifiedImages;
})(cool || (cool = {}));

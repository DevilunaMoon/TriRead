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
/*
 * Text runs as the prediction sees them, and the measurer that turns text into widths.
 */
var cool;
(function (cool) {
    function isHighSurrogate(code) {
        return code >= 0xd800 && code <= 0xdbff;
    }
    cool.isHighSurrogate = isHighSurrogate;
    function isLowSurrogate(code) {
        return code >= 0xdc00 && code <= 0xdfff;
    }
    cool.isLowSurrogate = isLowSurrogate;
    // The start and the length in UTF-16 units of the part of its buffer a run shows.
    function textWindow(run) {
        const start = run.textPosition ?? 0;
        return { start, length: run.textLength ?? (run.text ?? '').length - start };
    }
    cool.textWindow = textWindow;
    // The part of its buffer a run shows.
    function visibleText(run) {
        const { start, length } = textWindow(run);
        return (run.text ?? '').substring(start, start + length);
    }
    cool.visibleText = visibleText;
    // The lines and marks the engine sends with a run fit the text and the place it sent. A run
    // that changes drops them and is drawn with plain lines until the engine answers.
    function dropDecorations(run) {
        const decorated = run;
        delete decorated.decorations;
        delete decorated.decorationsInTextColor;
    }
    cool.dropDecorations = dropDecorations;
    // Shared off-screen 2d context for measuring text, created on first use.
    let measureContext;
    /// The width of a string as the renderer draws the run, in a loaded font or the fallback
    /// family. Zero without a 2d context.
    function canvasTextMeasure(hasFont) {
        return (run, text) => {
            if (measureContext === undefined) {
                const canvas = document.createElement('canvas');
                measureContext = canvas.getContext('2d');
                // Widths are summed per code point. Without kerning the sum matches the whole.
                if (measureContext && 'fontKerning' in measureContext)
                    measureContext.fontKerning = 'none';
            }
            if (!measureContext)
                return 0;
            const family = cool.VectorPrimitiveRenderer.resolveFontFamily(run, hasFont);
            measureContext.font = cool.VectorPrimitiveRenderer.cssFont(run, family);
            return measureContext.measureText(text).width;
        };
    }
    cool.canvasTextMeasure = canvasTextMeasure;
    /// Measures text in a run's font and scales it to the server's measure. Widths are sums of
    /// single code points, so the parts of a text add up to the whole. Kerning is lost, and the
    /// server's layout restores it.
    class TextMeasurer {
        constructor(measure) {
            this.measure = measure;
        }
        width(run, text) {
            let width = 0;
            for (const character of text)
                width += this.measure(run, character);
            return width;
        }
        // The step to each UTF-16 unit from the one before. A surrogate pair puts its width
        // on its first unit.
        unitAdvances(run, text) {
            const advances = [];
            for (const character of text) {
                advances.push(this.measure(run, character));
                for (let k = 1; k < character.length; k++)
                    advances.push(0);
            }
            return advances;
        }
        // The ratio of the run's server advances to its browser width, from its letters
        // only, since justification stretches spaces. A run of spaces uses all its text,
        // and a run without advances has the factor 1.
        serverScale(run) {
            const steps = run.coveringAdvances();
            if (!steps)
                return 1;
            let letterServer = 0;
            let letterBrowser = 0;
            let allServer = 0;
            let allBrowser = 0;
            let unit = 0;
            for (const character of run.visibleText) {
                let server = 0;
                for (let k = 0; k < character.length; k++)
                    server += steps[unit + k];
                unit += character.length;
                const browser = this.measure(run.primitive, character);
                allServer += server;
                allBrowser += browser;
                if (character !== ' ') {
                    letterServer += server;
                    letterBrowser += browser;
                }
            }
            if (letterServer > 0 && letterBrowser > 0)
                return letterServer / letterBrowser;
            if (allServer > 0 && allBrowser > 0)
                return allServer / allBrowser;
            return 1;
        }
    }
    cool.TextMeasurer = TextMeasurer;
    /// A text run primitive with its place on the slide. The primitive is the cached tree's,
    /// so edits through the run change the tree.
    class TextRun {
        constructor(primitive, 
        // Run origin in slide twips.
        x, baseline, 
        // The accumulated transform above the run.
        transform, 
        // The children array that holds the run.
        container) {
            this.primitive = primitive;
            this.x = x;
            this.baseline = baseline;
            this.transform = transform;
            this.container = container;
            const matrix = cool.Matrix2D.fromArray(primitive.matrix) ?? cool.Matrix2D.IDENTITY;
            this.rotated = matrix.b !== 0 || matrix.c !== 0;
        }
        get fontSize() {
            return this.primitive.fontSize ?? 12;
        }
        // The scale from the run's local space to the slide.
        get scaleX() {
            return this.transform.a || 1;
        }
        get scaleY() {
            return Math.abs(this.transform.d) || 1;
        }
        // The line's ascent and height in local space, estimated from the font size when
        // the run has none.
        get lineAscent() {
            return this.primitive.lineAscent || this.fontSize * 0.8;
        }
        get lineHeight() {
            return this.primitive.lineHeight || this.fontSize * 1.2;
        }
        // The slide x of a local distance from the run's origin.
        slideX(local) {
            return this.x + local * this.scaleX;
        }
        get paragraph() {
            return this.primitive.paragraph;
        }
        // The buffer, which holds the paragraph text around the run's window.
        get text() {
            return this.primitive.text ?? '';
        }
        set text(text) {
            this.primitive.text = text;
            dropDecorations(this.primitive);
        }
        // The window of the buffer that the run shows, in UTF-16 units.
        get start() {
            return this.primitive.textPosition ?? 0;
        }
        set start(start) {
            this.primitive.textPosition = start;
            dropDecorations(this.primitive);
        }
        get length() {
            return textWindow(this.primitive).length;
        }
        set length(length) {
            this.primitive.textLength = length;
            dropDecorations(this.primitive);
        }
        get end() {
            return this.start + this.length;
        }
        get visibleText() {
            return visibleText(this.primitive);
        }
        // The run's origin in local space, where advances and wrapping work.
        get localX() {
            return this.primitive.matrix?.[4] ?? 0;
        }
        get localBaseline() {
            return this.primitive.matrix?.[5] ?? 0;
        }
        // The advances when they cover the visible text, otherwise null.
        coveringAdvances() {
            const advances = this.primitive.advances;
            const length = this.length;
            return advances && advances.length >= length && length > 0
                ? advances
                : null;
        }
        // Replaces the advances of units [cutFrom, cutTo). A run with too few advances
        // drops them and is measured.
        spliceAdvances(cutFrom, cutTo, inserted) {
            const steps = this.coveringAdvances();
            if (steps)
                this.primitive.advances = [
                    ...steps.slice(0, cutFrom),
                    ...inserted,
                    ...steps.slice(cutTo, this.length),
                ];
            else if (this.primitive.advances)
                this.primitive.advances = undefined;
            dropDecorations(this.primitive);
        }
        // The local x before each character, from the advances or measured. The last entry
        // is the run width.
        characterPositions(measurer) {
            const text = this.visibleText;
            const length = text.length;
            const positions = new Array(length + 1);
            positions[0] = 0;
            const advances = this.coveringAdvances() ?? measurer.unitAdvances(this.primitive, text);
            for (let k = 1; k <= length; k++)
                positions[k] = positions[k - 1] + advances[k - 1];
            return positions;
        }
        // The width of the visible text in local space.
        width(measurer) {
            const positions = this.characterPositions(measurer);
            return positions[positions.length - 1];
        }
        // Moves the run's origin by a distance in slide twips.
        shift(delta) {
            const matrix = this.primitive.matrix;
            if (matrix && matrix.length === 6)
                matrix[4] += delta / (this.transform.a || 1);
            dropDecorations(this.primitive);
        }
        // The text runs of a subtree, with their origins in slide twips. A bullet or a numbering
        // label is text of its own in front of the paragraph, so its runs are left out.
        static collect(primitives, matrix = cool.Matrix2D.IDENTITY, out = []) {
            if (!primitives)
                return out;
            for (const primitive of primitives) {
                if (primitive.type === cool.TextHierarchyBulletPrimitive.type)
                    continue;
                let childMatrix = matrix;
                if (primitive.type === cool.TransformPrimitive.type) {
                    const transformMatrix = cool.Matrix2D.fromArray(primitive.matrix);
                    if (transformMatrix)
                        childMatrix = transformMatrix.then(matrix);
                }
                else if (TextRun.isTextRun(primitive)) {
                    const run = primitive;
                    const runMatrix = cool.Matrix2D.fromArray(run.matrix) ?? cool.Matrix2D.IDENTITY;
                    const origin = matrix.apply(runMatrix.e, runMatrix.f);
                    out.push(new TextRun(run, origin.x, origin.y, matrix, primitives));
                }
                TextRun.collect(primitive.children, childMatrix, out);
            }
            return out;
        }
        static isTextRun(primitive) {
            return (primitive.type === cool.TextSimplePortionPrimitive.type ||
                primitive.type === cool.TextDecoratedPortionPrimitive.type);
        }
    }
    cool.TextRun = TextRun;
})(cool || (cool = {}));

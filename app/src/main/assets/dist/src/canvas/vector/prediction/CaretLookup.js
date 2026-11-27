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
 * Finds the run and offset of a caret, from its logical position or its rectangle.
 */
var cool;
(function (cool) {
    /// A field of a caret message, a string or a number, as a number. Undefined if empty.
    function numberInMessage(value) {
        if (value === undefined || value === null)
            return undefined;
        if (typeof value === 'string' && value.trim() === '')
            return undefined;
        const number = Number(value);
        return isNaN(number) ? undefined : number;
    }
    cool.numberInMessage = numberInMessage;
    // True when the caret's height overlaps the run's line.
    function onLine(run, caretYTop, caretYBottom) {
        const ascent = run.lineAscent * run.scaleY;
        const descent = (run.lineHeight - run.lineAscent) * run.scaleY;
        return !(run.baseline - ascent > caretYBottom || run.baseline + descent < caretYTop);
    }
    cool.onLine = onLine;
    // The buffer every run carries, or null when they differ, as with a field such as a date,
    // which has a buffer of its own.
    function sharedParagraphText(runs) {
        const first = runs.length ? runs[0].text : '';
        for (const run of runs)
            if (run.text !== first)
                return null;
        return first;
    }
    cool.sharedParagraphText = sharedParagraphText;
    // The buffer most runs carry, the longest one on a tie.
    function paragraphText(runs) {
        const counts = new Map();
        for (const run of runs)
            counts.set(run.text, (counts.get(run.text) ?? 0) + 1);
        let best = '';
        let bestCount = 0;
        for (const [text, count] of counts)
            if (count > bestCount ||
                (count === bestCount && text.length > best.length)) {
                best = text;
                bestCount = count;
            }
        return best;
    }
    // True when the run is a field: its buffer is not its paragraph's text.
    function isFieldRun(run, siblings) {
        if (run.paragraph == null)
            return false;
        const paragraphRuns = siblings.filter((other) => other.paragraph === run.paragraph);
        return run.text !== paragraphText(paragraphRuns);
    }
    // The paragraph's runs in reading order, without its fields. The offsets of the other runs
    // already skip a field's character.
    function paragraphTextRuns(siblings, paragraph) {
        const paragraphRuns = siblings.filter((run) => !run.rotated && run.paragraph === paragraph);
        const text = paragraphText(paragraphRuns);
        return paragraphRuns
            .filter((run) => run.text === text)
            .sort((a, b) => a.baseline - b.baseline || a.x - b.x);
    }
    cool.paragraphTextRuns = paragraphTextRuns;
    // The run and offset for a paragraph index, or null. At a line break the index ends one run
    // and starts the next, and the run on the caret's line wins. Without a baseline (NaN),
    // atEnd picks the run that ends there, otherwise the one that starts there. An index past
    // the end goes to the end of the last run. An index before the first run, such as before a
    // leading tab, has none.
    function locateLogical(siblings, logical, caretBaseline) {
        const paragraphRuns = paragraphTextRuns(siblings, logical.paragraph);
        if (!paragraphRuns.length)
            return null;
        if (logical.index < paragraphRuns[0].start)
            return null;
        let fallback = null;
        let previous = paragraphRuns[0];
        for (const run of paragraphRuns) {
            // An index at a boundary matches two runs.
            if (logical.index >= run.start && logical.index <= run.end) {
                const candidate = { run, offset: logical.index - run.start };
                if (run.baseline === caretBaseline)
                    return candidate;
                if (!fallback || (isNaN(caretBaseline) && !logical.atEnd))
                    fallback = candidate;
            }
            // For the fallback below.
            if (run.start <= logical.index)
                previous = run;
        }
        if (fallback)
            return fallback;
        // An index in a gap or past the last run goes to the end of the run before it.
        return { run: previous, offset: previous.length };
    }
    // The runs after the target on its line, or null when one is rotated and cannot shift.
    function collectRightward(siblings, target) {
        const rightward = [];
        for (const run of siblings) {
            if (run === target)
                continue;
            if (run.baseline !== target.baseline)
                continue;
            if (run.x <= target.x)
                continue;
            if (run.transform.b !== 0 || run.transform.c !== 0)
                return null;
            rightward.push(run);
        }
        return rightward;
    }
    /// A page's cached tree, where the prediction finds carets.
    class PredictionTree {
        constructor(data, measurer) {
            this.data = data;
            this.measurer = measurer;
        }
        /// The position at a caret, or null. The rectangle picks the object, and the
        /// logical caret the run and offset. Without one, caretX snaps to the nearest
        /// boundary.
        caretAt(caretX, caretYTop, caretYBottom, logical) {
            let target = null;
            let bestDelta = Infinity;
            // The runs of the target's object. An edit shifts only these.
            let siblings = [];
            let targetObjectId;
            for (const id of this.data.order) {
                const object = this.data.objects.get(id);
                if (!object)
                    continue;
                const runs = cool.TextRun.collect(object.primitives);
                for (const run of runs) {
                    if (run.rotated)
                        continue;
                    if (!onLine(run, caretYTop, caretYBottom))
                        continue;
                    // The pixels alone never pick a field.
                    if (!logical && isFieldRun(run, runs))
                        continue;
                    const positions = run.characterPositions(this.measurer);
                    const left = run.x;
                    const right = run.slideX(positions[positions.length - 1]);
                    const delta = caretX < left ? left - caretX : caretX > right ? caretX - right : 0;
                    // With a logical caret the pixels only pick the object, and
                    // after a re-wrap the caret can be far from every run.
                    // Without one, the caret must be within a font size.
                    const withinReach = logical ? true : delta < run.fontSize;
                    if (withinReach && delta < bestDelta) {
                        bestDelta = delta;
                        target = { run, positions };
                        siblings = runs;
                        targetObjectId = object.id;
                    }
                }
            }
            if (!target)
                return null;
            let run = target.run;
            let positions = target.positions;
            let offset;
            const located = logical
                ? locateLogical(siblings, logical, target.run.baseline)
                : null;
            if (located) {
                run = located.run;
                positions = run.characterPositions(this.measurer);
                offset = Math.max(0, Math.min(located.offset, positions.length - 1));
            }
            else if (logical) {
                // No run in the object covers the logical position.
                return null;
            }
            else {
                offset = PredictionTree.nearestBoundary(run, positions, caretX);
            }
            const rightward = collectRightward(siblings, run);
            if (rightward === null)
                return null;
            return new cool.CaretPosition(run, offset, rightward, positions, siblings, this.measurer, targetObjectId);
        }
        /// The position of a logical caret in the object with the given id, or null. It
        /// needs no rectangle, so a recorded caret works in a tree the server replaced.
        caretIn(objectId, logical) {
            const object = this.data.objects.get(objectId);
            if (!object)
                return null;
            const runs = cool.TextRun.collect(object.primitives);
            const located = locateLogical(runs, logical, NaN);
            if (!located)
                return null;
            const positions = located.run.characterPositions(this.measurer);
            const rightward = collectRightward(runs, located.run);
            if (rightward === null)
                return null;
            return new cool.CaretPosition(located.run, Math.max(0, Math.min(located.offset, positions.length - 1)), rightward, positions, runs, this.measurer, objectId);
        }
        // The character boundary closest to the caret, outside surrogate pairs.
        static nearestBoundary(run, positions, caretX) {
            const text = run.visibleText;
            let offset = 0;
            let offsetDelta = Infinity;
            for (let k = 0; k < positions.length; k++) {
                if (k > 0 &&
                    k < text.length &&
                    cool.isHighSurrogate(text.charCodeAt(k - 1)) &&
                    cool.isLowSurrogate(text.charCodeAt(k)))
                    continue;
                const distance = Math.abs(caretX - run.slideX(positions[k]));
                if (distance < offsetDelta) {
                    offsetDelta = distance;
                    offset = k;
                }
            }
            return offset;
        }
    }
    cool.PredictionTree = PredictionTree;
})(cool || (cool = {}));

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
 * Edits the cached tree as the user types, so text shows before the server re-renders.
 *
 * Existing glyphs keep the server's advances, and typed text is measured. The line takes the
 * change in width as its alignment places it. A line that crosses its wrap width re-wraps the
 * paragraph. Rotated runs are left to the server.
 */
var cool;
(function (cool) {
    /// True for text without line breaks and tabs, which need the server's layout.
    function canPredictText(text) {
        return (!!text &&
            text.indexOf('\n') === -1 &&
            text.indexOf('\r') === -1 &&
            text.indexOf('\t') === -1);
    }
    cool.canPredictText = canPredictText;
    // Steps count code points from index towards limit and returns where it stops.
    function stepCodePoints(text, index, count, limit) {
        const direction = limit < index ? -1 : 1;
        for (; count > 0 && index !== limit; count--) {
            index += direction;
            if (index !== limit &&
                cool.isLowSurrogate(text.charCodeAt(index)) &&
                cool.isHighSurrogate(text.charCodeAt(index - 1)))
                index += direction;
        }
        return index;
    }
    /// An offset in a run where edits apply. positions[k] is the local x before character k.
    class CaretPosition {
        constructor(run, offset, rightward, positions, 
        // Every run of the run's object.
        objectRuns, measurer, 
        // The id of the run's object, when the tree has ids.
        objectId) {
            this.run = run;
            this.offset = offset;
            this.rightward = rightward;
            this.positions = positions;
            this.objectRuns = objectRuns;
            this.measurer = measurer;
            this.objectId = objectId;
        }
        /// True when the position ends its run, which at a line break also starts the next.
        get atEnd() {
            return this.offset > 0 && this.offset === this.positions.length - 1;
        }
        /// The caret at this position, in slide twips.
        geometry() {
            const run = this.run;
            const x = run.slideX(this.positions[this.offset] ?? 0);
            const ascent = run.lineAscent * run.scaleY;
            return {
                x,
                top: run.baseline - ascent,
                height: run.lineHeight * run.scaleY,
            };
        }
        /// Inserts text and returns its width, or a width of 0 when nothing changed.
        insert(text) {
            const nothing = { advance: 0, caretShift: 0 };
            if (!canPredictText(text))
                return nothing;
            const paragraph = cool.Paragraph.at(this);
            // Typed text is measured and scaled to the server's measure.
            const scale = this.measurer.serverScale(this.run);
            const advance = this.measurer.width(this.run.primitive, text) * scale;
            // Text without width is left to the server.
            if (!(advance > 0))
                return nothing;
            const overflows = paragraph !== null && paragraph.lineOverflows(this, advance);
            this.insertIntoRun(text, scale);
            const slideAdvance = advance * this.run.scaleX;
            if (paragraph && overflows) {
                paragraph.reflow();
                return { advance: slideAdvance, caretShift: slideAdvance };
            }
            // The caret moves with the typed text, less what its line moved left.
            const leftShare = this.alignLine(slideAdvance);
            return { advance: slideAdvance, caretShift: slideAdvance - leftShare };
        }
        /// Deletes code points before and after the caret. A wrapped paragraph, or one the
        /// deletion leaves the run in, is re-wrapped so words can move up.
        delete(before, after) {
            const nothing = {
                removed: 0,
                removedBefore: 0,
                caretShift: 0,
            };
            const paragraph = cool.Paragraph.at(this);
            // In a paragraph that can re-wrap, a deletion may leave the run, so a
            // backspace at a line start removes the break space.
            const run = this.run;
            const whole = run.text;
            const lowest = paragraph ? paragraph.firstStart : run.start;
            const highest = paragraph ? paragraph.lastEnd : run.end;
            const caret = run.start + this.offset;
            const from = stepCodePoints(whole, caret, before, lowest);
            const to = stepCodePoints(whole, caret, after, highest);
            if (to <= from)
                return nothing;
            const scale = this.measurer.serverScale(run);
            const removedWidth = this.widthOf(from, to, scale) * run.scaleX;
            const beforeWidth = this.widthOf(from, caret, scale) * run.scaleX;
            const crossed = from < run.start || to > run.end;
            this.deleteRange(from, to);
            let leftShare = 0;
            if (paragraph && (paragraph.lineCount > 1 || crossed))
                paragraph.reflow();
            else
                leftShare = this.alignLine(-removedWidth);
            // The caret moves back over the text removed before it, less what its line
            // moved left.
            return {
                removed: to - from,
                removedBefore: caret - from,
                caretShift: 0 - beforeWidth - leftShare,
            };
        }
        // The runs of the caret's paragraph on the caret's line.
        lineRuns() {
            return this.objectRuns.filter((run) => run.paragraph === this.run.paragraph &&
                run.baseline === this.run.baseline);
        }
        // The extent of the caret's line in local space.
        lineExtent() {
            let left = Infinity;
            let right = -Infinity;
            for (const run of this.lineRuns()) {
                left = Math.min(left, run.localX);
                right = Math.max(right, run.localX + run.width(this.measurer));
            }
            return right > left ? right - left : 0;
        }
        // The width of the caret's line without justification, in the server's measure.
        naturalLineWidth() {
            let width = 0;
            for (const run of this.lineRuns())
                width +=
                    this.measurer.width(run.primitive, run.visibleText) *
                        this.measurer.serverScale(run);
            return width;
        }
        // The local width of the paragraph offsets [from, to). Text outside the run is
        // measured and scaled.
        widthOf(from, to, scale) {
            if (to <= from)
                return 0;
            const run = this.run;
            const insideFrom = Math.max(from, run.start) - run.start;
            const insideTo = Math.min(to, run.end) - run.start;
            let width = 0;
            if (insideTo > insideFrom)
                width += this.positions[insideTo] - this.positions[insideFrom];
            let outside = '';
            if (from < run.start)
                outside += run.text.substring(from, Math.min(to, run.start));
            if (to > run.end)
                outside += run.text.substring(Math.max(from, run.end), to);
            if (outside)
                width += this.measurer.width(run.primitive, outside) * scale;
            return width;
        }
        // The runs of the paragraph that share the caret run's buffer.
        bufferRuns() {
            const run = this.run;
            if (run.paragraph == null)
                return [run];
            return this.objectRuns.filter((other) => other.paragraph === run.paragraph && other.text === run.text);
        }
        // Inserts text into every run of the buffer, with scaled advances for the typed
        // characters. Windows after the caret shift right.
        insertIntoRun(text, scale) {
            const run = this.run;
            const length = run.length;
            const clamped = Math.max(0, Math.min(this.offset, length));
            const at = run.start + clamped;
            const inserted = this.measurer
                .unitAdvances(run.primitive, text)
                .map((advance) => advance * scale);
            run.spliceAdvances(clamped, clamped, inserted);
            for (const other of this.bufferRuns()) {
                const whole = other.text;
                other.text = whole.substring(0, at) + text + whole.substring(at);
                if (other === run)
                    other.length = length + text.length;
                else if (other.start >= at)
                    other.start += text.length;
            }
        }
        // Removes [from, to) from every run of the buffer. Later windows move left and
        // overlapping ones shrink.
        deleteRange(from, to) {
            const removed = to - from;
            for (const other of this.bufferRuns()) {
                const whole = other.text;
                const start = other.start;
                const length = other.length;
                const cutFrom = Math.max(from, start) - start;
                const cutTo = Math.min(to, start + length) - start;
                if (cutTo > cutFrom) {
                    other.spliceAdvances(cutFrom, cutTo, []);
                    other.length = length - (cutTo - cutFrom);
                }
                if (start >= to)
                    other.start = start - removed;
                else if (start > from)
                    other.start = from;
                other.text = whole.substring(0, from) + whole.substring(to);
            }
        }
        /*
            Keeps the caret's line aligned after its width changed by delta, in slide
            twips, and returns how far the line's start moved left. The runs before the
            caret move left by half of delta on a centered line and by all of it on a
            right-aligned one, and the runs after the caret take the rest. A justified
            line keeps its start and its word spacing, and grows at its end like a
            left-aligned one, until the server lays it out again.
        */
        alignLine(delta) {
            const align = this.run.primitive.align;
            const leftShare = align === 'center' ? delta / 2 : align === 'right' ? delta : 0;
            if (leftShare)
                for (const run of this.lineRuns())
                    if (!this.rightward.includes(run))
                        run.shift(-leftShare);
            for (const run of this.rightward)
                run.shift(delta - leftShare);
            return leftShare;
        }
    }
    cool.CaretPosition = CaretPosition;
    /// Typed text, which replaces a selection in the caret's paragraph, as in the engine.
    function typedChange(text, selected) {
        return selected
            ? { text, deleteBefore: selected.before, deleteAfter: selected.after }
            : { text };
    }
    cool.typedChange = typedChange;
    /// A deletion around the caret that takes the selection in its paragraph, like the engine.
    function deletedChange(before, after, selected) {
        if (selected) {
            // The engine takes one key to delete the selection, whichever kind comes first.
            if (before > 0)
                before--;
            else
                after--;
            before += selected.before;
            after += selected.after;
        }
        return { deleteBefore: before, deleteAfter: after };
    }
    cool.deletedChange = deletedChange;
    /// Applies the deletion, then the insertion at the caret looked up again after it. The
    /// result has no text when the insertion was not predicted. Null when nothing changed.
    function applyPredictedChange(tree, position, logical, change) {
        const deleteBefore = change.deleteBefore ?? 0;
        const deleteAfter = change.deleteAfter ?? 0;
        let indexShift = 0;
        let caretShift = 0;
        let deleted = false;
        if (deleteBefore > 0 || deleteAfter > 0) {
            const result = position.delete(deleteBefore, deleteAfter);
            if (result.removed === 0)
                return null;
            deleted = true;
            indexShift = -result.removedBefore;
            caretShift = result.caretShift;
        }
        const deletion = {
            indexShift,
            caretShift,
            position,
            change: { deleteBefore, deleteAfter },
        };
        const text = change.text;
        if (text === undefined)
            return deleted ? deletion : null;
        if (deleted) {
            const objectId = position.objectId;
            if (objectId === undefined || !logical)
                return deletion;
            const after = tree.caretIn(objectId, {
                paragraph: logical.paragraph,
                index: Math.max(0, logical.index + indexShift),
            });
            if (!after)
                return deletion;
            position = after;
        }
        const inserted = position.insert(text);
        if (!(inserted.advance > 0))
            return deleted ? deletion : null;
        return {
            indexShift: indexShift + text.length,
            caretShift: caretShift + inserted.caretShift,
            position,
            change: deleted ? { text, deleteBefore, deleteAfter } : { text },
        };
    }
    cool.applyPredictedChange = applyPredictedChange;
    /// The code points selected before and after the caret, up to the anchor.
    function selectedAround(position, anchor) {
        const text = position.run.text;
        const caret = position.run.start + position.offset;
        const count = (from, to) => [...text.slice(from, to)].length;
        return {
            before: anchor.index < caret ? count(anchor.index, caret) : 0,
            after: anchor.index > caret ? count(caret, anchor.index) : 0,
        };
    }
    cool.selectedAround = selectedAround;
})(cool || (cool = {}));

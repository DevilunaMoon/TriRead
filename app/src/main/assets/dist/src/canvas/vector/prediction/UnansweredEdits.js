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
 * The changes typed here that the engine has not answered yet. Each change holds the ticket of
 * its input message, which takes the number of the message when it goes out. An answer of the
 * engine names the newest input it applied, and drops the changes it includes,
 * and the ones left are applied again to what the answer brought. A caret update of the engine
 * that predates the newest change leaves the caret where the typing put it.
 */
var cool;
(function (cool) {
    /// What a caret update of the engine means for the changes typed here.
    let CaretUpdateVerdict;
    (function (CaretUpdateVerdict) {
        /// The update predates the newest change, so the caret typed here stays.
        CaretUpdateVerdict[CaretUpdateVerdict["Older"] = 0] = "Older";
        /// The update includes the newest change and puts the caret where the typing left
        /// it, or it says nothing about the typing.
        CaretUpdateVerdict[CaretUpdateVerdict["Current"] = 1] = "Current";
        /// The update includes the newest change and puts the caret elsewhere, as after an
        /// autocorrection, so the typing no longer matches the engine.
        CaretUpdateVerdict[CaretUpdateVerdict["Elsewhere"] = 2] = "Elsewhere";
    })(CaretUpdateVerdict = cool.CaretUpdateVerdict || (cool.CaretUpdateVerdict = {}));
    /// The changes the engine has not answered, oldest first. A matches function picks the
    /// changes of one part, and without it every change counts.
    class UnansweredEdits {
        constructor() {
            this.edits = [];
        }
        /// Keeps a change applied here until the engine answers it.
        record(edit) {
            this.edits.push(edit);
        }
        has(matches) {
            return matches ? this.edits.some(matches) : this.edits.length > 0;
        }
        /// The newest change that matches, or undefined.
        newest(matches) {
            for (let at = this.edits.length - 1; at >= 0; --at)
                if (!matches || matches(this.edits[at]))
                    return this.edits[at];
            return undefined;
        }
        /// Drops the changes that match.
        forget(matches) {
            this.edits = matches ? this.edits.filter((edit) => !matches(edit)) : [];
        }
        /// Drops the changes that match and that an answer of the engine includes: those up
        /// to inputSequence, or all of them when it is undefined. Returns the matching
        /// changes left, oldest first.
        answered(inputSequence, matches) {
            this.edits = this.edits.filter((edit) => (inputSequence !== undefined &&
                !edit.ticket.appliedBy(inputSequence)) ||
                (!!matches && !matches(edit)));
            return matches ? this.edits.filter(matches) : this.edits.slice();
        }
        /// The number of the change's message. A change whose message has no number yet is
        /// older than every caret moved after it, told or not, so it sorts below any number.
        static sentAs(edit) {
            return edit.ticket.sentAs() ?? -Infinity;
        }
        /// Applies the changes again, oldest first. False as soon as one does not apply,
        /// which leaves the ones before it applied.
        static applyAgain(edits, apply) {
            for (const edit of edits)
                if (!apply(edit))
                    return false;
            return true;
        }
        /// What a caret update means for the newest change that matches. inEdit is true
        /// when the object the update names is the one that change went into. expected is
        /// where the engine puts the caret once it has that change, by default the caret
        /// after it.
        verdictOn(update, inEdit, matches, expected) {
            const newest = this.newest(matches);
            if (!newest)
                return CaretUpdateVerdict.Current;
            const inputSequence = cool.numberInMessage(update.inputSequence);
            if (inputSequence === undefined)
                return CaretUpdateVerdict.Current;
            if (!newest.ticket.appliedBy(inputSequence))
                return CaretUpdateVerdict.Older;
            const caret = expected ? expected(newest) : newest.caretAfter;
            const paragraph = cool.numberInMessage(update.paragraph);
            const index = cool.numberInMessage(update.index);
            const objectId = cool.numberInMessage(update.object);
            const otherObject = objectId !== undefined && !inEdit(objectId, newest);
            const elsewhere = paragraph !== undefined &&
                index !== undefined &&
                (paragraph !== caret.paragraph || index !== caret.index);
            return otherObject || elsewhere
                ? CaretUpdateVerdict.Elsewhere
                : CaretUpdateVerdict.Current;
        }
    }
    cool.UnansweredEdits = UnansweredEdits;
    /// Draws the caret of this view at the geometry, in document twips.
    function showCaret(geometry) {
        app.file.textCursor.rectangle = new cool.SimpleRectangle(geometry.x, geometry.top, 0, geometry.height);
        app.map._docLayer._onUpdateCursor();
    }
    cool.showCaret = showCaret;
})(cool || (cool = {}));

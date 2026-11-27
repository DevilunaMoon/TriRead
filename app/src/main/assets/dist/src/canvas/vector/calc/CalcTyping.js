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
 * Shows the typing of this view in its cell edit before the engine answers. The typing goes into a
 * copy of the text edits of the sheet. Each change is kept under the sequence number of its input
 * message until an engine answer includes it, and the changes an answer does not include are
 * applied to it again. A change that no longer fits drops the typing.
 */
var cool;
(function (cool) {
    /// The engine key codes of the keys that move the caret or end the cell edit, by the names
    /// that UNOKey gives them.
    const editMovingKeys = {
        DOWN: 1024,
        UP: 1025,
        LEFT: 1026,
        RIGHT: 1027,
        HOME: 1028,
        END: 1029,
        PAGEUP: 1030,
        PAGEDOWN: 1031,
        RETURN: 1280,
        ESCAPE: 1281,
        TAB: 1282,
    };
    /// True for a key above or a mouse press. The caret is unknown until the engine reports it.
    function calcInputMovesEdit(message) {
        const tokens = message.split(' ');
        if (tokens[0] === 'mouse')
            return tokens[1] === 'type=buttondown';
        if (tokens[0] !== 'key' && tokens[0] !== 'windowkey')
            return false;
        if (!tokens.includes('type=input'))
            return false;
        const keyToken = tokens.find((token) => token.startsWith('key='));
        if (!keyToken)
            return false;
        // The modifier bits start at 4096.
        const code = Number(keyToken.substring(4)) & 4095;
        return Object.values(editMovingKeys).includes(code);
    }
    cool.calcInputMovesEdit = calcInputMovesEdit;
    class CalcTyping {
        /// The id of the one object of the tree of a cell edit.
        static { this.entryId = 1; }
        constructor(measurer) {
            this.measurer = measurer;
            /// The sheet typed in, or undefined without typing.
            this.part = undefined;
            /// The text edits of that sheet with the typing in them.
            this.typed = null;
            /// The changes the engine has not answered.
            this.pending = new cool.UnansweredEdits();
            /// True from an input that moves the edit until the engine reports the caret again.
            this.held = false;
        }
        /// Drops the typing and pauses it until the next caret update of the engine.
        holdUntilCaret() {
            this.forget();
            this.held = true;
        }
        /// True while typing waits for the caret update of the engine.
        isHeld() {
            return this.held;
        }
        /// The text edits to draw for the sheet: the ones given, or the copy with the typing.
        editsOf(part, edits) {
            return this.typed && this.part === part ? this.typed : edits;
        }
        /// True while typed changes wait for the engine, in the given sheet or in any sheet.
        isTyping(part) {
            return this.pending.has() && (part === undefined || this.part === part);
        }
        /// True when a keystroke at the caret would show here. Nothing changes.
        canTypeAt(edits, viewId, origin, caret) {
            if (this.held || !CalcTyping.covers(caret, false))
                return false;
            const placed = this.treeOf(edits, viewId, origin);
            return placed !== null && CalcTyping.lookUp(placed.tree, caret) !== null;
        }
        /// Applies a change at the caret and keeps it until the engine answers. build gets the
        /// selected code points around the caret, or null. Returns the new caret, or null.
        type(part, edits, viewId, origin, caret, ticket, build) {
            if (this.held)
                return null;
            if (!caret.logical || !CalcTyping.covers(caret, true))
                return null;
            // Typing in another sheet starts over from the edits of the engine there.
            if (this.part !== part)
                this.forget();
            const typed = this.typed ?? CalcTyping.copyOf(edits);
            const placed = this.treeOf(typed, viewId, origin);
            if (!placed)
                return null;
            const position = CalcTyping.lookUp(placed.tree, caret);
            if (!position)
                return null;
            const selected = caret.anchor
                ? cool.selectedAround(position, caret.anchor)
                : null;
            const applied = cool.applyPredictedChange(placed.tree, position, caret.logical, build(selected));
            if (!applied)
                return null;
            const caretAfter = {
                paragraph: caret.logical.paragraph,
                index: Math.max(0, caret.logical.index + applied.indexShift),
                atEnd: applied.position.atEnd,
            };
            this.part = part;
            this.typed = typed;
            this.pending.record({
                ticket,
                column: placed.edit.column ?? 0,
                row: placed.edit.row ?? 0,
                caretBefore: { ...caret.logical, atEnd: position.atEnd },
                caretAfter,
                ...applied.change,
            });
            return this.caretIn(placed.tree, caretAfter);
        }
        /// Drops the changes the engine edits include and applies the rest again. An undefined
        /// inputSequence includes every input. Returns the new caret, or null when none is left.
        answered(part, edits, inputSequence, viewId, origin) {
            if (this.part !== part || !this.pending.has())
                return null;
            const left = this.pending.answered(inputSequence);
            if (!left.length) {
                this.forget();
                return null;
            }
            const typed = CalcTyping.copyOf(edits);
            const placed = this.treeOf(typed, viewId, origin);
            if (!placed ||
                !cool.UnansweredEdits.applyAgain(left, (change) => this.applyAgain(placed, change))) {
                this.forget();
                return null;
            }
            this.typed = typed;
            return this.caretIn(placed.tree, left[left.length - 1].caretAfter);
        }
        /// The caret after the newest change. It follows its cell when the sheet geometry changes.
        caretAfterTyping(viewId, origin) {
            const newest = this.pending.newest();
            if (!this.typed || !newest)
                return null;
            const placed = this.treeOf(this.typed, viewId, origin);
            if (!placed)
                return null;
            return this.caretIn(placed.tree, newest.caretAfter);
        }
        /// True when the update is older than the newest change. A current update that moves the
        /// caret away from the typing, as after an autocorrection, drops the typing.
        keepsCaret(update) {
            this.held = false;
            // A caret in a drawing object is not in the cell.
            const verdict = this.pending.verdictOn(update, () => false);
            if (verdict === cool.CaretUpdateVerdict.Elsewhere)
                this.forget();
            return verdict === cool.CaretUpdateVerdict.Older;
        }
        /// Drop the typing, so the edits of the engine are drawn.
        forget() {
            this.part = undefined;
            this.typed = null;
            this.pending.forget();
        }
        /// The cell edit in tile twips. The tree shares its primitives, so changes reach the edit.
        treeOf(edits, viewId, origin) {
            const edit = edits.find((one) => one.viewId === viewId &&
                one.parent === undefined &&
                one.column !== undefined &&
                one.row !== undefined);
            if (!edit || edit.column === undefined || edit.row === undefined)
                return null;
            // A cell edit is in twips from the top-left corner of its first cell.
            const corner = origin(edit.column, edit.row);
            if (!corner)
                return null;
            const move = {
                type: cool.TransformPrimitive.type,
                matrix: [1, 0, 0, 1, corner.x, corner.y],
                children: edit.primitives,
            };
            const id = CalcTyping.entryId;
            const data = {
                partId: '',
                mode: 0,
                slideWidth: 0,
                slideHeight: 0,
                objects: new Map([[id, { id, primitives: [move] }]]),
                order: [id],
            };
            return { tree: new cool.PredictionTree(data, this.measurer), edit };
        }
        /// Apply a change kept from before. It applies in the same cell only.
        applyAgain(placed, change) {
            if (placed.edit.column !== change.column ||
                placed.edit.row !== change.row)
                return false;
            const position = placed.tree.caretIn(CalcTyping.entryId, change.caretBefore);
            if (!position)
                return false;
            return (cool.applyPredictedChange(placed.tree, position, change.caretBefore, change) !== null);
        }
        caretIn(tree, logical) {
            const geometry = tree.caretIn(CalcTyping.entryId, logical)?.geometry();
            return geometry
                ? {
                    geometry,
                    logical: { paragraph: logical.paragraph, index: logical.index },
                }
                : null;
        }
        /// True when typing at the caret shows here. A selection must be in one paragraph.
        static covers(caret, replacing) {
            const selected = caret.selected || caret.anchor !== null;
            if (!selected)
                return true;
            return (replacing &&
                caret.anchor !== null &&
                caret.logical !== null &&
                caret.anchor.paragraph === caret.logical.paragraph);
        }
        static lookUp(tree, caret) {
            return tree.caretAt(caret.rectangle.x1, caret.rectangle.y1, caret.rectangle.y2, caret.logical ?? undefined);
        }
        /// A copy of the text edits that a change can go into.
        static copyOf(edits) {
            return JSON.parse(JSON.stringify(edits));
        }
    }
    cool.CalcTyping = CalcTyping;
})(cool || (cool = {}));

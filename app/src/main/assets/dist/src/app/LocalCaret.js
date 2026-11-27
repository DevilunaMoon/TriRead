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
class LocalCaret {
    /// The prefixes of the messages that neither read nor move the caret.
    static { this.unrelated = [
        'tile ',
        'tilecombine ',
        'canceltiles',
        'clientvisiblearea ',
        'clientzoom ',
        'commandvalues command=.uno:Vector',
        'useractive',
        'userinactive',
    ]; }
    /// The newest caret moved here, while the engine has not answered for it, or null.
    static { this.caret = null; }
    /// The sequence number of the textcursor message that told the engine of the caret, or 0
    /// while the engine has not been told.
    static { this.sequence = 0; }
    /// The timer that tells the engine once the caret rests, or null while none runs.
    static { this.restTimer = null; }
    static moved(caret) {
        LocalCaret.caret = caret;
        LocalCaret.sequence = 0;
        LocalCaret.stopRestTimer();
        LocalCaret.restTimer = app.timerRegistry.setTimeout('localcaretrest', () => {
            LocalCaret.restTimer = null;
            LocalCaret.tell();
        }, VectorSettings.caretRestDelay());
    }
    static stopRestTimer() {
        if (LocalCaret.restTimer === null)
            return;
        app.timerRegistry.clearTimeout(LocalCaret.restTimer);
        LocalCaret.restTimer = null;
    }
    /// The caret moved here while the engine is behind it, with the sequence number of the
    /// message that told the engine. Infinity while the engine has not been told, so the caret
    /// is newer than any input sent.
    static ahead() {
        if (!LocalCaret.caret)
            return null;
        return {
            caret: LocalCaret.caret,
            sequence: LocalCaret.sequence || Infinity,
        };
    }
    /// Tells the engine where the caret is, once for each move, in a message with the next
    /// sequence number.
    static tell() {
        LocalCaret.stopRestTimer();
        const caret = LocalCaret.caret;
        if (!caret || LocalCaret.sequence)
            return;
        // The text typed before the caret moved goes out first, so its numbers are below
        // the caret's. The number is taken before the message goes out, so it is older than
        // the message itself. The message carries no change, so the tickets waiting for the
        // next message keep waiting.
        ChangeOutbox.sendTheTextAhead();
        LocalCaret.sequence = cool.InputSequence.next([], false);
        const anchor = caret.anchor
            ? ' anchorparagraph=' +
                caret.anchor.paragraph +
                ' anchorindex=' +
                caret.anchor.index
            : '';
        app.socket.sendMessage('textcursor object=' +
            caret.objectId +
            ' paragraph=' +
            caret.logical.paragraph +
            ' index=' +
            caret.logical.index +
            anchor +
            ' sequence=' +
            LocalCaret.sequence);
    }
    /// Tells the engine where the caret is when the message may read or move it, and returns
    /// the message to send after that.
    static tellBefore(message) {
        if (!LocalCaret.caret || LocalCaret.sequence)
            return message;
        // What the outbox sends itself was made before the caret moved, so it goes first.
        if (ChangeOutbox.sending || LocalCaret.isUnrelated(message))
            return message;
        // A message numbered just now gives its number back, so the caret takes it and goes
        // out first, and the message is stamped again after that. The numbers rise in the
        // order the messages go out.
        const unstamped = cool.InputSequence.unstamp(message);
        LocalCaret.tell();
        return unstamped
            ? cool.InputSequence.stamp(unstamped.message, unstamped.tickets)
            : message;
    }
    /// True for a message that neither reads nor moves the caret.
    static isUnrelated(message) {
        return (LocalCaret.unrelated.some((prefix) => message.startsWith(prefix)) ||
            LocalCaret.isHover(message));
    }
    // True for a mouse move with no button down, which neither reads nor moves the caret.
    static isHover(message) {
        const parser = new MessageParser(message);
        return (parser.command === 'mouse' &&
            parser.value('type') === 'move' &&
            parser.value('buttons') === '0');
    }
    /// True when the caret update from the engine is older than the caret here, which then
    /// stays. The update that answers the textcursor message, or a later input, carries the
    /// engine's caret.
    static isAhead(update) {
        if (!LocalCaret.caret)
            return false;
        if (!LocalCaret.sequence)
            return true;
        const inputSequence = Number(update.inputSequence);
        if (update.inputSequence === undefined || isNaN(inputSequence))
            return true;
        if (inputSequence < LocalCaret.sequence)
            return true;
        LocalCaret.caughtUp();
        return false;
    }
    // The engine's caret is current again. The held selection stays.
    static caughtUp() {
        LocalCaret.stopRestTimer();
        LocalCaret.caret = null;
        LocalCaret.sequence = 0;
    }
    /// Drops the caret moved here, and the selection messages held while it was ahead.
    static forget() {
        LocalCaret.caughtUp();
        LocalCaret.heldSelection.clear();
    }
    /// Drops the caret moved here once the caret is hidden, and returns the held selection
    /// messages, oldest first, as no caret update follows. A caret the engine was not told of
    /// is told first: an edit that runs on keeps it, and one that ended ignores it.
    static release() {
        LocalCaret.tell();
        LocalCaret.caughtUp();
        return LocalCaret.takeHeld();
    }
    /// The newest held selection message of each kind, keyed by the message name.
    static { this.heldSelection = new Map(); }
    /// Holds a selection message from the engine while the caret here is ahead, replacing the
    /// held one of its kind. The engine sends the selection before the caret update it goes
    /// with. False while the caret here is not ahead.
    static hold(message) {
        if (!LocalCaret.caret)
            return false;
        const kind = message.substring(0, message.indexOf(':'));
        LocalCaret.heldSelection.delete(kind);
        LocalCaret.heldSelection.set(kind, message);
        return true;
    }
    /// Takes the held selection messages, oldest first, once the engine caught up. Empty while
    /// the caret here is ahead.
    static takeHeld() {
        if (LocalCaret.caret)
            return [];
        const held = [...LocalCaret.heldSelection.values()];
        LocalCaret.heldSelection.clear();
        return held;
    }
}

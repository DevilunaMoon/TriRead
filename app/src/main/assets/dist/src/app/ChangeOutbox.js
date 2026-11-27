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
class ChangeOutbox {
    /// How long a change may go unanswered before the next one goes out anyway, in milliseconds.
    static { this.longestWait = 400; }
    /// How long after the last undo or redo went out its results are taken as all in, where
    /// some never arrive, in milliseconds. The engine reports a result for each of them.
    static { this.longestUndoWait = 10000; }
    /// How long the delta of an undo or a redo is waited for once its result is in, in
    /// milliseconds. The engine sends the two close together, in either order.
    static { this.deltaAfterUndo = 250; }
    /// The commands besides the mapping of objects that change one thing to a state they name,
    /// each with where the part that names the thing ends and the state begins.
    static { this.namedStates = {
        setobjecthandle: ' x=',
        setobjectcontrolpoint: ' x=',
        setobjectgluepoint: ' x=',
        cropobject: ' x1=',
        setobjectpoints: ' changes=',
    }; }
    static { this.waiting = []; }
    static { this.held = new Map(); }
    static { this.keysDown = new Set(); }
    /// The usual number of changes in flight at a time. More than one keeps a run of key
    /// presses going out at the pace they are made over a slow connection, few enough for the
    /// engine to keep up.
    static { this.usualMostInFlight = 4; }
    /// The most changes in flight at a time, 1 or more.
    static { this.mostInFlight = ChangeOutbox.usualMostInFlight; }
    /// How long typed text and deletions wait before they go out, so that more of them combine
    /// into one message, in milliseconds. At 0 they go out as soon as a change may.
    static { this.textWait = 0; }
    /// One wait for each change in flight, the oldest first, with the number of a numbered
    /// message. An undo or a redo has none.
    static { this.inFlight = []; }
    /// How many undos and redos went out whose result the engine has not reported yet.
    static { this.undosUnanswered = 0; }
    /// True from the result of the last undo or redo that went out until the delta it brings.
    static { this.undoSettling = false; }
    /// Which of the two went out last.
    static { this.undoKind = 'undo'; }
    /// The wait for the delta after the results, or for results that never arrive.
    static { this.undoTimeout = null; }
    static { this.listening = false; }
    /// True while the outbox itself sends, so the socket lets the message through.
    static { this.sending = false; }
    /// True while a key is being handled, so the changes it makes are held until it is let go.
    static { this.madeByAKey = false; }
    /// The code of the key whose press repeats while it is held down, with Ctrl or Cmd: Z or Y.
    /// Empty while no such press is being handled.
    static { this.repeatingKey = ''; }
    /// The ticket of the change of objects taken last, or null where the message offered last
    /// as such a change was not taken as one.
    static { this.lastTicket = null; }
    /*
        Runs what a key press does with the changes it makes held until the keys are let go. The
        key is remembered as down until its release is seen.
    */
    static byAKey(event, does) {
        ChangeOutbox.listen();
        ChangeOutbox.keysDown.add(event.code || event.key);
        ChangeOutbox.madeByAKey = true;
        try {
            return does();
        }
        finally {
            ChangeOutbox.madeByAKey = false;
            // A key that made nothing to hold is not waited for.
            if (!ChangeOutbox.held.size)
                ChangeOutbox.keysDown.clear();
        }
    }
    /*
        Takes a message on its way to the engine, if it is one the outbox holds to the engine's
        pace, and answers whether it took it. It holds the changes of objects, the undos and
        redos and the typed text, in a view that draws from the objects only.
    */
    static take(message) {
        // What the outbox sends itself comes through here too, and is not a new offer.
        if (ChangeOutbox.sending)
            return false;
        if (!RenderManager.isVectorRendering())
            return false;
        const entry = ChangeOutbox.entryOf(message);
        if (!entry)
            return false;
        if (entry.kind === 'transform' || entry.kind === 'other') {
            const ticket = new cool.InputTicket();
            entry.tickets.push(ticket);
            ChangeOutbox.lastTicket = ticket;
        }
        ChangeOutbox.listen();
        if (entry.kind === 'text' || entry.kind === 'remove') {
            // The message is stamped again when it goes out, so its number goes back and the
            // tickets of the edit it carries wait with it.
            entry.tickets = cool.InputSequence.unstamp(message)?.tickets ?? [];
            ChangeOutbox.letGoOfWhatIsHeld();
            ChangeOutbox.merge(entry);
            // What merges into the entry afterwards goes out with it once its wait is
            // over. An entry whose wait is over, kept back by the changes in flight, waits
            // again from what was just merged into it.
            const last = ChangeOutbox.waiting[ChangeOutbox.waiting.length - 1];
            if ((last.kind === 'text' || last.kind === 'remove') &&
                last.ready !== false &&
                ChangeOutbox.textWait > 0) {
                last.ready = false;
                setTimeout(() => {
                    last.ready = true;
                    ChangeOutbox.sendTheNext();
                }, ChangeOutbox.textWait);
            }
        }
        else if (entry.kind === 'undo' || entry.kind === 'redo') {
            if (!ChangeOutbox.undoOnItsWay())
                ChangeOutbox.undoAskedAt = performance.now();
            // The repeats of a held Ctrl+Z or Ctrl+Y are held until the key is let go, and go out
            // as one undo or redo of that many steps.
            if (ChangeOutbox.repeatingKey) {
                ChangeOutbox.keysDown.add(ChangeOutbox.repeatingKey);
                ChangeOutbox.hold(entry);
                return true;
            }
            ChangeOutbox.letGoOfWhatIsHeld();
            ChangeOutbox.merge(entry);
        }
        else if (ChangeOutbox.madeByAKey) {
            ChangeOutbox.hold(entry);
            return true;
        }
        else {
            ChangeOutbox.merge(entry);
        }
        ChangeOutbox.sendTheNext();
        return true;
    }
    /*
        Sends the waiting text ahead of a message that the engine applies in order after it,
        however many changes are in flight, and returns the message to send after that. A message
        numbered just now gives its number to what goes ahead of it and is stamped again, so the
        numbers rise in the order the messages go out. A message that neither reads nor moves
        the caret goes out on its own.
    */
    static sendAhead(message) {
        if (ChangeOutbox.sending || !ChangeOutbox.textWaits())
            return message;
        if (LocalCaret.isUnrelated(message))
            return message;
        const unstamped = cool.InputSequence.unstamp(message);
        ChangeOutbox.sendTheTextAhead();
        return unstamped
            ? cool.InputSequence.stamp(unstamped.message, unstamped.tickets)
            : message;
    }
    /// Sends everything waiting where typed text or a deletion is among it, however many
    /// changes are in flight, so that a message sent after this goes out after the text. With
    /// no text waiting, the changes keep to the engine's pace.
    static sendTheTextAhead() {
        if (ChangeOutbox.textWaits())
            ChangeOutbox.sendAllWaiting();
    }
    /// Sends everything waiting, however many changes are in flight.
    static sendAllWaiting() {
        if (ChangeOutbox.sending)
            return;
        while (ChangeOutbox.waiting.length)
            ChangeOutbox.send(ChangeOutbox.waiting.shift());
    }
    /// Whether typed text or a deletion waits to go out.
    static textWaits() {
        return ChangeOutbox.waiting.some((entry) => entry.kind === 'text' || entry.kind === 'remove');
    }
    /// Sets the most changes in flight at a time, or puts back the usual number for null. A
    /// higher number sends what waits for it at once.
    static setMostInFlight(count) {
        ChangeOutbox.mostInFlight =
            count === null ? ChangeOutbox.usualMostInFlight : Math.max(1, count);
        ChangeOutbox.sendTheNext();
    }
    /// Sets how long typed text and deletions wait before they go out, in milliseconds, 0 for
    /// no wait. Text that waits already keeps its own wait.
    static setTextWait(milliseconds) {
        ChangeOutbox.textWait = Math.max(0, milliseconds);
    }
    /// Sends a message that changes objects and returns the ticket it was taken with, or null
    /// where it was not taken as a change of objects, as when the socket let it go unsent.
    static sendAChange(message) {
        ChangeOutbox.lastTicket = null;
        app.socket.sendMessage(message);
        return ChangeOutbox.lastTicket;
    }
    /// Whether an undo or a redo waits to go out or has not been answered yet.
    static undoOnItsWay() {
        return ChangeOutbox.waitsFor() !== null;
    }
    /// When the undos and redos on their way began to be asked for, in the time of
    /// performance.now(). Only meaningful while one is on its way.
    static { this.undoAskedAt = 0; }
    /// How long the undos and redos on their way have been waited for, in milliseconds; zero
    /// while none is on its way.
    static undoWaitedFor() {
        return ChangeOutbox.undoOnItsWay()
            ? performance.now() - ChangeOutbox.undoAskedAt
            : 0;
    }
    /// The undo or the redo that goes out first among those waiting or in flight, or null where
    /// there is none.
    static waitsFor() {
        if (ChangeOutbox.undosUnanswered > 0 || ChangeOutbox.undoSettling)
            return ChangeOutbox.undoKind;
        for (const entry of ChangeOutbox.waiting)
            if (entry.kind === 'undo' || entry.kind === 'redo')
                return entry.kind;
        for (const entry of ChangeOutbox.held.values())
            if (entry.kind === 'undo' || entry.kind === 'redo')
                return entry.kind;
        return null;
    }
    /// The entry a message stands for, or nothing for a message the outbox leaves alone.
    static entryOf(message) {
        if (message === 'uno .uno:Undo')
            return { kind: 'undo', count: 1 };
        if (message === 'uno .uno:Redo')
            return { kind: 'redo', count: 1 };
        const parser = new MessageParser(message);
        const typed = ChangeOutbox.typedEntryOf(parser);
        if (typed)
            return typed;
        // The outbox writes the message again from its parameters, so one with a parameter
        // more is left alone.
        const to = parser.value('to');
        const what = parser.value('as');
        if (parser.command === 'setobjecttransform' &&
            parser.length === 3 &&
            to !== undefined &&
            what) {
            const mappings = new Map();
            for (const one of to.split(';')) {
                if (!one)
                    continue;
                mappings.set(one.split(',')[0], one);
            }
            return { kind: 'transform', what, mappings, tickets: [] };
        }
        const stateBegins = ChangeOutbox.namedStates[parser.command];
        if (stateBegins === undefined)
            return null;
        const at = message.indexOf(stateBegins);
        return {
            kind: 'other',
            channel: at < 0 ? message : message.substring(0, at),
            message,
            tickets: [],
        };
    }
    /*
        The entry of a numbered message with text typed into the document itself, or null for any
        other message. Text typed into a dialog gets no delta as an answer. The outbox writes
        these messages again from their parameters, so a message with a parameter more is left
        alone.
    */
    static typedEntryOf(parser) {
        if (parser.value('id') !== '0')
            return null;
        if (parser.sequence === undefined)
            return null;
        const text = parser.value('text');
        if (parser.command === 'textinput' &&
            parser.length === 4 &&
            text !== undefined)
            return { kind: 'text', text, tickets: [] };
        const before = parser.count('before');
        const after = parser.count('after');
        if (parser.command === 'removetextcontext' &&
            parser.length === 5 &&
            before !== undefined &&
            after !== undefined)
            return { kind: 'remove', before, after, tickets: [] };
        return null;
    }
    /// Keeps the entry until the keys are let go, in place of what was held for the same thing:
    /// the newest mapping of each object, the newest state of anything else, the undos or the
    /// redos added up.
    static hold(entry) {
        if (entry.kind === 'undo' || entry.kind === 'redo') {
            const before = ChangeOutbox.held.get(entry.kind);
            if (before && before.kind === entry.kind)
                before.count += entry.count;
            else
                ChangeOutbox.held.set(entry.kind, entry);
            return;
        }
        if (entry.kind === 'transform') {
            const before = ChangeOutbox.held.get('transform');
            if (before && before.kind === 'transform') {
                for (const [objectId, mapping] of entry.mappings)
                    before.mappings.set(objectId, mapping);
                before.what = entry.what;
                before.tickets.push(...entry.tickets);
            }
            else
                ChangeOutbox.held.set('transform', entry);
            return;
        }
        if (entry.kind === 'other') {
            const before = ChangeOutbox.held.get(entry.channel);
            if (before && before.kind === 'other')
                entry.tickets.unshift(...before.tickets);
            ChangeOutbox.held.set(entry.channel, entry);
        }
    }
    /// Sends what keys have made, once they are let go or the window loses the keyboard.
    static letGoOfWhatIsHeld() {
        ChangeOutbox.keysDown.clear();
        if (!ChangeOutbox.held.size)
            return;
        // What the keys made is one step of the undo of its own, so it waits sealed.
        for (const entry of ChangeOutbox.held.values()) {
            ChangeOutbox.merge(entry);
            const last = ChangeOutbox.waiting[ChangeOutbox.waiting.length - 1];
            if (last && (last.kind === 'transform' || last.kind === 'other'))
                last.sealed = true;
        }
        ChangeOutbox.held.clear();
        ChangeOutbox.sendTheNext();
    }
    /// Adds the entry to what is waiting, merged into the last waiting entry where they go
    /// together and that one is not sealed: changes of objects keep the newest state of each
    /// thing, and undos or redos add up. An entry of another kind waits behind.
    static merge(entry) {
        const last = ChangeOutbox.waiting[ChangeOutbox.waiting.length - 1];
        if (last &&
            last.kind === 'transform' &&
            !last.sealed &&
            entry.kind === 'transform' &&
            last.what === entry.what) {
            for (const [objectId, mapping] of entry.mappings)
                last.mappings.set(objectId, mapping);
            last.tickets.push(...entry.tickets);
            return;
        }
        if (last &&
            last.kind === 'other' &&
            !last.sealed &&
            entry.kind === 'other' &&
            last.channel === entry.channel) {
            last.message = entry.message;
            last.tickets.push(...entry.tickets);
            return;
        }
        if (last &&
            (last.kind === 'undo' || last.kind === 'redo') &&
            last.kind === entry.kind) {
            last.count += entry.count;
            return;
        }
        if (last && last.kind === 'text' && entry.kind === 'text') {
            last.text += entry.text;
            last.tickets.push(...entry.tickets);
            return;
        }
        // The engine deletes before the caret first, so two deletions merge only when that
        // keeps their order.
        if (last &&
            last.kind === 'remove' &&
            entry.kind === 'remove' &&
            (last.after === 0 || entry.before === 0)) {
            last.before += entry.before;
            last.after += entry.after;
            last.tickets.push(...entry.tickets);
            return;
        }
        ChangeOutbox.waiting.push(entry);
    }
    /// Sends the waiting entries in their order while fewer than mostInFlight are in flight.
    static sendTheNext() {
        while (ChangeOutbox.inFlight.length < ChangeOutbox.mostInFlight &&
            ChangeOutbox.waiting.length) {
            // Text still in its wait holds back what came after it, so the order stays.
            const next = ChangeOutbox.waiting[0];
            if ((next.kind === 'text' || next.kind === 'remove') &&
                next.ready === false)
                return;
            ChangeOutbox.send(ChangeOutbox.waiting.shift());
        }
    }
    /// Sends the entry, numbered now, which is in flight from now on.
    static send(entry) {
        const wait = setTimeout(() => ChangeOutbox.answered(wait), ChangeOutbox.longestWait);
        let message = ChangeOutbox.messageOf(entry);
        let sequence;
        if (entry.kind === 'undo' || entry.kind === 'redo') {
            ChangeOutbox.undosUnanswered++;
            ChangeOutbox.undoSettling = false;
            ChangeOutbox.undoKind = entry.kind;
            ChangeOutbox.awaitTheUndos(ChangeOutbox.longestUndoWait);
        }
        // An undo or a redo is not numbered. Everything else goes out with the next number. The
        // entry holds the tickets of every change merged into it, and only those take the number.
        if ('tickets' in entry) {
            sequence = cool.InputSequence.next(entry.tickets, false);
            message += ' sequence=' + sequence;
        }
        // The kit sends its callbacks after the whole batch it read, so one delta can answer
        // several changes at once. The number says which: every change up to it.
        ChangeOutbox.inFlight.push({ wait, sequence });
        ChangeOutbox.sending = true;
        try {
            app.socket.sendMessage(message);
        }
        finally {
            ChangeOutbox.sending = false;
        }
    }
    /// The message an entry goes out as, before its sequence token. An undo or a redo of more
    /// than one step names the number, which the engine's undo takes as an argument.
    static messageOf(entry) {
        if (entry.kind === 'other')
            return entry.message;
        if (entry.kind === 'text')
            return 'textinput id=0 text=' + entry.text;
        if (entry.kind === 'remove')
            return ('removetextcontext id=0 before=' +
                entry.before +
                ' after=' +
                entry.after);
        if (entry.kind === 'transform')
            return ('setobjecttransform to=' +
                Array.from(entry.mappings.values()).join(';') +
                ' as=' +
                entry.what);
        const command = entry.kind === 'undo' ? 'Undo' : 'Redo';
        if (entry.count === 1)
            return 'uno .uno:' + command;
        return ('uno .uno:' +
            command +
            ' ' +
            JSON.stringify({
                [command]: { type: 'unsigned short', value: String(entry.count) },
            }));
    }
    /// A change in flight was answered, the oldest one, or the one of that wait was waited for
    /// long enough: the next one may go.
    static answered(wait) {
        const at = wait === undefined
            ? 0
            : ChangeOutbox.inFlight.findIndex((one) => one.wait === wait);
        if (at < 0 || at >= ChangeOutbox.inFlight.length)
            return;
        clearTimeout(ChangeOutbox.inFlight[at].wait);
        ChangeOutbox.inFlight.splice(at, 1);
        ChangeOutbox.sendTheNext();
    }
    /*
        The engine's delta answered everything in flight up to the newest message with a sequence
        number at most inputSequence. A delta below the number of the oldest change in flight
        answers none, as it reflects an input sent before that change or another view's edit. An
        undo or a redo has no number, so where one is the oldest in flight, it takes the delta. A
        delta without a number answers the oldest change.
    */
    static deltaArrived(inputSequence) {
        let answered = 1;
        if (inputSequence !== undefined) {
            answered = ChangeOutbox.inFlight[0]?.sequence === undefined ? 1 : 0;
            ChangeOutbox.inFlight.forEach((one, at) => {
                if (one.sequence !== undefined && one.sequence <= inputSequence)
                    answered = at + 1;
            });
        }
        for (const one of ChangeOutbox.inFlight.splice(0, answered))
            clearTimeout(one.wait);
        ChangeOutbox.sendTheNext();
    }
    /// Takes the undos and redos that went out as all in after that many milliseconds.
    static awaitTheUndos(milliseconds) {
        if (ChangeOutbox.undoTimeout)
            clearTimeout(ChangeOutbox.undoTimeout);
        ChangeOutbox.undoTimeout = setTimeout(() => ChangeOutbox.undosAreIn(), milliseconds);
    }
    /*
        The undos and redos that went out are all in, or were waited for long enough. What waits
        for them runs, unless more of them wait to go out still.
    */
    static undosAreIn() {
        if (ChangeOutbox.undoTimeout)
            clearTimeout(ChangeOutbox.undoTimeout);
        ChangeOutbox.undoTimeout = null;
        ChangeOutbox.undosUnanswered = 0;
        ChangeOutbox.undoSettling = false;
        if (ChangeOutbox.undoOnItsWay() || !ChangeOutbox.afterTheUndos.length)
            return;
        const waiting = ChangeOutbox.afterTheUndos;
        ChangeOutbox.afterTheUndos = [];
        for (const callback of waiting)
            callback();
    }
    /// What is to run once no undo or redo is on its way any more, in the order it was given.
    static { this.afterTheUndos = []; }
    /// Runs the callback once no undo or redo is on its way any more; at once where none is.
    static whenTheUndosAreIn(callback) {
        if (!ChangeOutbox.undoOnItsWay()) {
            callback();
            return;
        }
        ChangeOutbox.afterTheUndos.push(callback);
    }
    /// The key with that code was let go: once no key is down, what keys made goes out.
    static keyIsUp(code) {
        if (code === ChangeOutbox.repeatingKey)
            ChangeOutbox.repeatingKey = '';
        ChangeOutbox.keysDown.delete(code);
        if (!ChangeOutbox.keysDown.size)
            ChangeOutbox.letGoOfWhatIsHeld();
    }
    /// The engine reported the result of an undo or a redo that went out. After the last of them
    /// the delta it brings is waited for a short while more.
    static undoReported() {
        if (ChangeOutbox.undosUnanswered <= 0)
            return;
        if (--ChangeOutbox.undosUnanswered > 0)
            return;
        ChangeOutbox.undoSettling = true;
        ChangeOutbox.awaitTheUndos(ChangeOutbox.deltaAfterUndo);
    }
    /*
        Listens for the engine's deltas, which answer what is in flight and, after the results of
        the undos and redos that went out, the last of them - a change laid on here is announced
        with an empty list and answers nothing - for the results of undos and redos, and for the
        keys being let go and the window losing the keyboard, which send what keys have made.
    */
    static listen() {
        if (ChangeOutbox.listening)
            return;
        ChangeOutbox.listening = true;
        // A press is seen here before it is handled, so a repeat of Ctrl+Z or Ctrl+Y is known as
        // one when its undo or redo arrives.
        document.addEventListener('keydown', (event) => {
            const undoKey = (event.ctrlKey || event.metaKey) &&
                (event.code === 'KeyZ' || event.code === 'KeyY');
            ChangeOutbox.repeatingKey = undoKey && event.repeat ? event.code : '';
        }, true);
        RenderManager.onVectorChanged((answered, inputSequence) => {
            if (answered !== undefined && !answered.length)
                return;
            if (ChangeOutbox.undoSettling)
                ChangeOutbox.undosAreIn();
            if (ChangeOutbox.inFlight.length)
                ChangeOutbox.deltaArrived(inputSequence);
        });
        app.map.on('commandresult', (event) => {
            if (event.commandName === '.uno:Undo' ||
                event.commandName === '.uno:Redo')
                ChangeOutbox.undoReported();
        });
        document.addEventListener('keyup', (event) => ChangeOutbox.keyIsUp(event.code || event.key), true);
        window.addEventListener('blur', () => ChangeOutbox.letGoOfWhatIsHeld());
    }
}

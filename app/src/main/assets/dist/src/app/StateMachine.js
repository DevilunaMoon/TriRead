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
// Keeps one state value and changes it only through transition(). A feature describes itself
// with a state enum, a trigger enum and the list of allowed moves, and the machine refuses any
// other move with a warning in the console.
class StateMachine {
    constructor(options) {
        this.options = options;
        this.current = options.initial;
    }
    get state() {
        return this.current;
    }
    is(...states) {
        return states.includes(this.current);
    }
    // The caller names the state it expects to be in, so a stale assumption is refused rather
    // than applied. Returns false for a refused move and leaves the state alone.
    transition(from, to, trigger) {
        if (this.current !== from) {
            this.warn('refused move from ' +
                this.stateName(from) +
                ' to ' +
                this.stateName(to) +
                ', the current state is ' +
                this.stateName(this.current));
            return false;
        }
        const move = this.options.transitions.find((candidate) => candidate.from === from &&
            candidate.to === to &&
            (candidate.triggers === undefined ||
                candidate.triggers.includes(trigger)));
        if (move === undefined) {
            this.warn('no move from ' +
                this.stateName(from) +
                ' to ' +
                this.stateName(to) +
                ' on ' +
                this.options.triggerNames[trigger]);
            return false;
        }
        this.current = to;
        if (move.action)
            move.action(from, to, trigger);
        if (from !== to && this.options.onChanged)
            this.options.onChanged(from, to, trigger);
        return true;
    }
    stateName(state) {
        return this.options.stateNames[state];
    }
    warn(message) {
        app.console.warn(this.options.name + ': ' + message);
    }
}

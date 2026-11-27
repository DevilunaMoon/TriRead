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
var cool;
(function (cool) {
    /// The callbacks to call when the vector content held changes, in the order they came.
    class VectorChangeListeners {
        constructor() {
            this.listeners = [];
        }
        add(listener) {
            this.listeners.push(listener);
        }
        remove(listener) {
            this.listeners = this.listeners.filter((other) => other !== listener);
        }
        /// Calls each listener with the ids of the objects an answer of the engine
        /// replaced, and the newest input of this view the answer reflects.
        fire(answered, inputSequence) {
            for (const listener of this.listeners)
                listener(answered, inputSequence);
        }
    }
    cool.VectorChangeListeners = VectorChangeListeners;
    /// The ids of the objects drawn apart from the rest of the content, such as the selection
    /// during a drag, and a version that counts up each time the ids change.
    class DrawnElsewhere {
        constructor() {
            this.ids = new Set();
            this.count = 0;
        }
        /// Takes the ids. An empty list leaves nothing out.
        set(objectIds) {
            const next = new Set(objectIds);
            const same = next.size === this.ids.size &&
                objectIds.every((id) => this.ids.has(id));
            if (same)
                return;
            this.ids = next;
            this.count++;
        }
        has(objectId) {
            return this.ids.has(objectId);
        }
        version() {
            return this.count;
        }
    }
    cool.DrawnElsewhere = DrawnElsewhere;
})(cool || (cool = {}));

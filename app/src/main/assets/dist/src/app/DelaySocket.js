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
// DelaySocket forwards send() and onmessage events with a fixed delay
// in each direction. See QueuedSocket for the shared queue machinery.
class DelaySocket extends QueuedSocket {
    constructor(inner, delayMs) {
        super(inner);
        this._delayMs = delayMs;
    }
    setDelay(delayMs) {
        this._delayMs = delayMs;
        this._reschedule();
    }
    _nextDelay() {
        return this._delayMs;
    }
}

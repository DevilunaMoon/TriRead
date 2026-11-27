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
/* eslint-disable @typescript-eslint/no-empty-function */
// QueuedSocket wraps an existing SockInterface and forwards send() and
// onmessage events through per-direction FIFO queues, releasing the head
// of each queue after a subclass-supplied delay. Open / close / error
// callbacks and readyState / binaryType are passed straight through.
// Subclasses model a particular network behaviour by overriding
// _nextDelay() and, for packet loss, _dropSend().
class QueuedSocket {
    constructor(inner) {
        this._sendQueue = [];
        this._sendTimer = null;
        this._recvQueue = [];
        this._recvTimer = null;
        this.onclose = () => { };
        this.onerror = () => { };
        this.onmessage = () => { };
        this.onopen = () => { };
        this._inner = inner;
        this._inner.onopen = (e) => this.onopen(e);
        this._inner.onerror = (e) => this.onerror(e);
        this._inner.onclose = (e) => this.onclose(e);
        this._inner.onmessage = (e) => this._enqueueRecv(e);
    }
    get readyState() {
        return this._inner.readyState;
    }
    get binaryType() {
        return this._inner.binaryType;
    }
    set binaryType(v) {
        this._inner.binaryType = v;
    }
    send(data) {
        this._sendQueue.push({ ts: Date.now(), data });
        if (!this._sendTimer)
            this._scheduleSend();
    }
    close(code, reason) {
        if (this._sendTimer)
            clearTimeout(this._sendTimer);
        if (this._recvTimer)
            clearTimeout(this._recvTimer);
        this._sendTimer = null;
        this._recvTimer = null;
        this._sendQueue = [];
        this._recvQueue = [];
        this._inner.close(code, reason);
    }
    setUnloading() {
        if (this._inner.setUnloading)
            this._inner.setUnloading();
    }
    // Detach from the inner socket: flush queued messages immediately
    // (preserving order), stop timers, and return the inner socket so
    // the caller can rewire callbacks back to it.
    unwrap() {
        if (this._sendTimer)
            clearTimeout(this._sendTimer);
        this._sendTimer = null;
        for (const item of this._sendQueue)
            this._inner.send(item.data);
        this._sendQueue = [];
        if (this._recvTimer)
            clearTimeout(this._recvTimer);
        this._recvTimer = null;
        for (const item of this._recvQueue)
            this.onmessage(item.evt);
        this._recvQueue = [];
        return this._inner;
    }
    // Cancel the pending delivery timers and recompute them from the
    // queue heads with a fresh _nextDelay() value.
    _reschedule() {
        if (this._sendTimer) {
            clearTimeout(this._sendTimer);
            this._sendTimer = null;
            this._scheduleSend();
        }
        if (this._recvTimer) {
            clearTimeout(this._recvTimer);
            this._recvTimer = null;
            this._scheduleRecv();
        }
    }
    // Whether the head send should be discarded rather than delivered.
    // The base wrapper never drops. Subclasses override to model loss.
    _dropSend() {
        return false;
    }
    _scheduleSend() {
        if (this._sendQueue.length === 0)
            return;
        const head = this._sendQueue[0];
        const wait = Math.max(0, head.ts + this._nextDelay() - Date.now());
        this._sendTimer = setTimeout(() => {
            this._sendTimer = null;
            const item = this._sendQueue.shift();
            if (item && !this._dropSend())
                this._inner.send(item.data);
            this._scheduleSend();
        }, wait);
    }
    _enqueueRecv(evt) {
        this._recvQueue.push({ ts: Date.now(), evt });
        if (!this._recvTimer)
            this._scheduleRecv();
    }
    _scheduleRecv() {
        if (this._recvQueue.length === 0)
            return;
        const head = this._recvQueue[0];
        const wait = Math.max(0, head.ts + this._nextDelay() - Date.now());
        this._recvTimer = setTimeout(() => {
            this._recvTimer = null;
            const item = this._recvQueue.shift();
            if (item)
                this.onmessage(item.evt);
            this._scheduleRecv();
        }, wait);
    }
}

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
class TimerRegistry {
    constructor() {
        this.timers = new Map();
        // Animation frames count their ids on their own, so an id can equal the id of a timer.
        this.frames = new Map();
    }
    setTimeout(tag, callback, delay) {
        const id = setTimeout(() => {
            const entry = this.timers.get(id);
            if (entry) {
                entry.fireCount++;
            }
            callback();
            // Auto-remove completed timeouts
            this.timers.delete(id);
        }, delay);
        this.timers.set(id, {
            tag,
            type: 'timeout',
            id,
            fireCount: 0,
            cancelled: false,
        });
        return id;
    }
    setInterval(tag, callback, delay) {
        const id = setInterval(() => {
            const entry = this.timers.get(id);
            if (entry) {
                entry.fireCount++;
            }
            callback();
        }, delay);
        this.timers.set(id, {
            tag,
            type: 'interval',
            id,
            fireCount: 0,
            cancelled: false,
        });
        return id;
    }
    requestAnimationFrame(tag, callback, owner = window) {
        const id = owner.requestAnimationFrame(() => {
            const entry = this.frames.get(id);
            if (entry) {
                entry.fireCount++;
            }
            callback();
            this.frames.delete(id);
        });
        this.frames.set(id, {
            tag,
            type: 'frame',
            id,
            fireCount: 0,
            cancelled: false,
            owner,
        });
        return id;
    }
    cancelAnimationFrame(id) {
        const entry = this.frames.get(id);
        if (entry) {
            entry.cancelled = true;
            entry.owner.cancelAnimationFrame(id);
            this.frames.delete(id);
        }
    }
    clearTimeout(id) {
        const entry = this.timers.get(id);
        if (entry) {
            entry.cancelled = true;
            clearTimeout(id);
            this.timers.delete(id);
        }
    }
    clearInterval(id) {
        const entry = this.timers.get(id);
        if (entry) {
            entry.cancelled = true;
            clearInterval(id);
            this.timers.delete(id);
        }
    }
    // For testing: check if all active timers with the given tag have fired at least once
    hasFired(tag) {
        for (const entry of this.entries()) {
            if (entry.tag === tag && entry.fireCount === 0) {
                return false;
            }
        }
        return true;
    }
    // For testing: check if there are any active (not cancelled) timers with the given tag
    hasActive(tag) {
        for (const entry of this.entries()) {
            if (entry.tag === tag) {
                return true;
            }
        }
        return false;
    }
    // For testing: get the number of times timers with the given tag have fired
    getFireCount(tag) {
        let count = 0;
        for (const entry of this.entries()) {
            if (entry.tag === tag) {
                count += entry.fireCount;
            }
        }
        return count;
    }
    entries() {
        return [...this.timers.values(), ...this.frames.values()];
    }
}
// Global instance
window.app = window.app || {};
window.app.timerRegistry = new TimerRegistry();

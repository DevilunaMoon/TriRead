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
class TimerEventQueue {
    constructor(aTimer) {
        this.aTimer = aTimer;
        this.aEventSet = new PriorityQueue(EventEntry.compare);
    }
    addEvent(aEvent) {
        this.DBG('TimerEventQueue.addEvent event(' + aEvent.getId() + ') appended.');
        if (!aEvent) {
            window.app.console.log('TimerEventQueue.addEvent: null event');
            return false;
        }
        const nTime = aEvent.getActivationTime(this.aTimer.getElapsedTime());
        const aEventEntry = new EventEntry(aEvent, nTime);
        this.aEventSet.push(aEventEntry);
        return true;
    }
    forceEmpty() {
        this.process_(true);
    }
    process() {
        this.process_(false);
    }
    process_(bFireAllEvents) {
        const nCurrentTime = this.aTimer.getElapsedTime();
        while (!this.isEmpty() &&
            (bFireAllEvents || this.aEventSet.top().nActivationTime <= nCurrentTime)) {
            const aEventEntry = this.aEventSet.top();
            this.aEventSet.pop();
            const aEvent = aEventEntry.aEvent;
            if (aEvent.isCharged())
                aEvent.fire();
        }
    }
    isEmpty() {
        return this.aEventSet.isEmpty();
    }
    nextTimeout() {
        let nTimeout = Number.MAX_VALUE;
        const nCurrentTime = this.aTimer.getElapsedTime();
        if (!this.isEmpty())
            nTimeout = this.aEventSet.top().nActivationTime - nCurrentTime;
        return nTimeout;
    }
    clear() {
        this.DBG('TimerEventQueue.clear invoked');
        this.aEventSet.clear();
    }
    getTimer() {
        return this.aTimer;
    }
    DBG(sMessage, nTime) {
        aTimerEventQueueDebugPrinter.print(sMessage, nTime);
    }
}
class EventEntry {
    constructor(aEvent, nTime) {
        this.aEvent = aEvent;
        this.nActivationTime = nTime;
    }
    static compare(aLhsEventEntry, aRhsEventEntry) {
        if (aLhsEventEntry.nActivationTime > aRhsEventEntry.nActivationTime) {
            return -1;
        }
        else if (aLhsEventEntry.nActivationTime < aRhsEventEntry.nActivationTime) {
            return 1;
        }
        else {
            return 0;
        }
    }
}

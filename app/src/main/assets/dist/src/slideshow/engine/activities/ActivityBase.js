// @ts-strict-ignore
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
class ActivityBase extends AnimationActivity {
    constructor(aCommonParamSet) {
        super();
        this.aTargetElement = null;
        this.aEndEvent = aCommonParamSet.aEndEvent;
        this.aTimerEventQueue = aCommonParamSet.aTimerEventQueue;
        this.nRepeats = aCommonParamSet.nRepeatCount;
        this.nAccelerationFraction = aCommonParamSet.nAccelerationFraction;
        this.nDecelerationFraction = aCommonParamSet.nDecelerationFraction;
        this.bAutoReverse = aCommonParamSet.bAutoReverse;
        this.bFirstPerformCall = true;
        this.bIsActive = true;
    }
    activate(aEndEvent) {
        this.aEndEvent = aEndEvent;
        this.bFirstPerformCall = true;
        this.bIsActive = true;
    }
    dispose() {
        // deactivate
        this.bIsActive = false;
        // dispose event
        if (this.aEndEvent)
            this.aEndEvent.dispose();
        this.aEndEvent = null;
    }
    perform() {
        // still active?
        if (!this.isActive())
            return false; // no, early exit.
        assert(!this.bFirstPerformCall, 'ActivityBase.perform: assertion (!this.FirstPerformCall) failed');
        return true;
    }
    calcTimeLag() {
        // TODO: implement different init process!
        if (this.isActive() && this.bFirstPerformCall) {
            this.bFirstPerformCall = false;
            // notify derived classes that we're
            // starting now
            this.startAnimation();
        }
        return 0.0;
    }
    isActive() {
        return this.bIsActive;
    }
    isDisposed() {
        return !this.bIsActive && !this.aEndEvent;
    }
    dequeued() {
        if (!this.isActive())
            this.endAnimation();
    }
    setTargets(aTargetElement) {
        assert(aTargetElement, 'ActivityBase.setTargets: target element is not valid');
        this.aTargetElement = aTargetElement;
    }
    // public abstract startAnimation(): void;
    startAnimation() {
        throw 'ActivityBase.startAnimation: abstract method invoked';
    }
    // public endAnimation(): void {
    // 	// TODO throw abstract
    // }
    endActivity() {
        // this is a regular activity end
        this.bIsActive = false;
        // Activity is ending, queue event, then
        if (this.aEndEvent)
            this.aTimerEventQueue.addEvent(this.aEndEvent);
        this.aEndEvent = null;
    }
    calcAcceleratedTime(nT) {
        // Handle acceleration/deceleration
        // clamp nT to permissible [0,1] range
        nT = clampN(nT, 0.0, 1.0);
        // take acceleration/deceleration into account. if the sum
        // of nAccelerationFraction and nDecelerationFraction
        // exceeds 1.0, ignore both (that's according to SMIL spec)
        if ((this.nAccelerationFraction > 0.0 || this.nDecelerationFraction > 0.0) &&
            this.nAccelerationFraction + this.nDecelerationFraction <= 1.0) {
            const nC = 1.0 -
                0.5 * this.nAccelerationFraction -
                0.5 * this.nDecelerationFraction;
            // this variable accumulates the new time value
            let nTPrime = 0.0;
            if (nT < this.nAccelerationFraction) {
                nTPrime += (0.5 * nT * nT) / this.nAccelerationFraction; // partial first interval
            }
            else {
                nTPrime += 0.5 * this.nAccelerationFraction; // full first interval
                if (nT <= 1.0 - this.nDecelerationFraction) {
                    nTPrime += nT - this.nAccelerationFraction; // partial second interval
                }
                else {
                    nTPrime +=
                        1.0 - this.nAccelerationFraction - this.nDecelerationFraction; // full second interval
                    const nTRelative = nT - 1.0 + this.nDecelerationFraction;
                    nTPrime +=
                        nTRelative -
                            (0.5 * nTRelative * nTRelative) / this.nDecelerationFraction;
                }
            }
            // normalize, and assign to work variable
            nT = nTPrime / nC;
        }
        return nT;
    }
    getEventQueue() {
        return this.aTimerEventQueue;
    }
    getTargetElement() {
        return this.aTargetElement;
    }
    isRepeatCountValid() {
        return !!this.nRepeats; // first ! convert to bool
    }
    getRepeatCount() {
        return this.nRepeats;
    }
    isAutoReverse() {
        return this.bAutoReverse;
    }
    end() {
        if (!this.isActive() || this.isDisposed())
            return;
        // assure animation is started:
        if (this.bFirstPerformCall) {
            this.bFirstPerformCall = false;
            // notify derived classes that we're starting now
            this.startAnimation();
        }
        this.performEnd();
        this.endAnimation();
        this.endActivity();
    }
}

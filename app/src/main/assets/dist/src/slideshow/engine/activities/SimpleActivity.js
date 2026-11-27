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
var DirectionType;
(function (DirectionType) {
    DirectionType[DirectionType["Backward"] = 0] = "Backward";
    DirectionType[DirectionType["Forward"] = 1] = "Forward";
})(DirectionType || (DirectionType = {}));
class SimpleActivity extends ContinuousActivityBase {
    constructor(aCommonParamSet, aNumberAnimation, eDirection) {
        super(aCommonParamSet);
        assert(eDirection == DirectionType.Backward ||
            eDirection == DirectionType.Forward, 'SimpleActivity constructor: animation direction is not valid');
        assert(aNumberAnimation, 'SimpleActivity constructor: animation object is not valid');
        this.aAnimation = aNumberAnimation;
        this.nDirection = eDirection == DirectionType.Forward ? 1.0 : 0.0;
    }
    startAnimation() {
        if (this.isDisposed() || !this.aAnimation)
            return;
        ANIMDBG.print('SimpleActivity.startAnimation invoked');
        super.startAnimation();
        // start animation
        this.aAnimation.start(this.getTargetElement());
    }
    endAnimation() {
        if (this.aAnimation)
            this.aAnimation.end();
    }
    performContinuousHook(nModifiedTime, nRepeatCount) {
        // nRepeatCount is not used
        if (this.isDisposed() || !this.aAnimation)
            return;
        const nT = 1.0 - this.nDirection + nModifiedTime * (2.0 * this.nDirection - 1.0);
        this.aAnimation.perform(nT, nT === this.nDirection);
    }
    performEnd() {
        if (this.aAnimation) {
            app.console.debug('SimpleActivity.performEnd');
            this.aAnimation.perform(this.nDirection, /*last:*/ true);
        }
    }
}

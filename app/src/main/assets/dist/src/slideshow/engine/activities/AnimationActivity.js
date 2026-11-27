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
class ActivityParamSet {
    constructor() {
        this.nMinNumberOfFrames = SlideShowHandler.MINIMUM_FRAMES_PER_SECONDS;
        this.bAutoReverse = false;
        this.nRepeatCount = 1.0;
        this.nAccelerationFraction = 0;
        this.nDecelerationFraction = 0;
        this.aDiscreteTimes = [];
    }
}
class AnimationActivity {
    static { this.CURR_UNIQUE_ID = 0; }
    constructor() {
        this.nId = AnimationActivity.getUniqueId();
    }
    static getUniqueId() {
        ++AnimationActivity.CURR_UNIQUE_ID;
        return AnimationActivity.CURR_UNIQUE_ID;
    }
    getId() {
        return this.nId;
    }
}

/* -*- tab-width: 4 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
var EffectState;
(function (EffectState) {
    EffectState[EffectState["NotStarted"] = 0] = "NotStarted";
    EffectState[EffectState["Playing"] = 1] = "Playing";
    EffectState[EffectState["Ended"] = 2] = "Ended";
})(EffectState || (EffectState = {}));
class Effect {
    constructor(nId = -1) {
        this.nId = nId;
        this.eState = EffectState.NotStarted;
    }
    getId() {
        return this.nId;
    }
    isMainEffect() {
        return this.nId === -1;
    }
    isPlaying() {
        return this.eState === EffectState.Playing;
    }
    isEnded() {
        return this.eState === EffectState.Ended;
    }
    start() {
        assert(this.eState === EffectState.NotStarted, 'Effect.start: wrong state.');
        this.eState = EffectState.Playing;
    }
    end() {
        assert(this.eState === EffectState.Playing, 'Effect.end: wrong state.');
        this.eState = EffectState.Ended;
    }
}

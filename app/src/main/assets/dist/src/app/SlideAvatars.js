/* -*- js-indent-level: 8 -*- */
/* global app */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class SlideAvatars {
    // Circles drawn over one preview, counter included.
    static { this.slotCount = 3; }
    // The counter carries one digit, so the chip stays a circle.
    static { this.counterCap = 9; }
    static slots(people, slotCount = SlideAvatars.slotCount) {
        if (!(people > 0) || !(slotCount > 0))
            return { faces: 0, hidden: 0 };
        if (people <= slotCount)
            return { faces: people, hidden: 0 };
        if (slotCount === 1)
            return { faces: 0, hidden: people };
        return { faces: slotCount - 1, hidden: people - (slotCount - 1) };
    }
    // Nine stands for nine or more.
    static counterText(hidden) {
        if (hidden > SlideAvatars.counterCap)
            return SlideAvatars.counterCap + '+';
        return '+' + hidden;
    }
}
app.SlideAvatars = SlideAvatars;

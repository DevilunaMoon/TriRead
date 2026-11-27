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
var cool;
(function (cool) {
    let PointArrayPrimitive;
    (function (PointArrayPrimitive) {
        PointArrayPrimitive.type = 'pointArray';
        /// Draws the object itself, not its text.
        PointArrayPrimitive.isObjectDrawing = true;
    })(PointArrayPrimitive = cool.PointArrayPrimitive || (cool.PointArrayPrimitive = {}));
})(cool || (cool = {}));

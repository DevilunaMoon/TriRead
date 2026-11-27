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
    let GraphicResource;
    (function (GraphicResource) {
        /// Type guard for primitives that carry a numeric checksum.
        function is(primitive) {
            return (typeof primitive.checksum === 'number');
        }
        GraphicResource.is = is;
    })(GraphicResource = cool.GraphicResource || (cool.GraphicResource = {}));
})(cool || (cool = {}));

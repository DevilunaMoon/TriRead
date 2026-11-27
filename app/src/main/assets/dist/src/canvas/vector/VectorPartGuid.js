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
    /// The page list a vector-rendering part index addresses.
    let VectorMode;
    (function (VectorMode) {
        VectorMode[VectorMode["Slides"] = 0] = "Slides";
        VectorMode[VectorMode["MasterPages"] = 1] = "MasterPages";
        VectorMode[VectorMode["NotesPages"] = 2] = "NotesPages";
    })(VectorMode = cool.VectorMode || (cool.VectorMode = {}));
    /// The key a page is filed under while it is known by its place in a
    /// list only: the mode and the index, joined with a colon.
    function vectorIndexKey(part, mode) {
        return String(mode) + ':' + String(part);
    }
    cool.vectorIndexKey = vectorIndexKey;
})(cool || (cool = {}));

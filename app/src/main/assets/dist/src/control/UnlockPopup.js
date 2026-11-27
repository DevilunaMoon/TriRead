// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * The body of the popup offering to unlock the features a locked user cannot use: an
 * illustration, a title, a description and a list of highlights.
 */
var UnlockPopup;
(function (UnlockPopup) {
    function build(imageUrl, title, description, highlights) {
        return (h("div", { class: "container" },
            h("img", { id: "unlock-image", src: imageUrl }),
            h("div", { class: "item" },
                h("h1", null, title),
                h("p", null, description),
                h("ul", null, highlights.map((highlight) => (h("li", null, highlight)))))));
    }
    UnlockPopup.build = build;
})(UnlockPopup || (UnlockPopup = {}));

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
/* global _ */
/*
 * A full-window hint shown while the user drags a file from the operating
 * system over the application window. It dims the window and shows a centered
 * card so the user can see that dropping the file will open it. The drop itself
 * is handled by the native side; this layer is only a visual cue and never
 * receives pointer events.
 */
var DropFileOverlay;
(function (DropFileOverlay) {
    let overlay = null;
    function build() {
        return (h("div", { class: "coda-drop-overlay", "aria-hidden": "true" },
            h("div", { class: "coda-drop-overlay-card" },
                h("span", { class: "coda-drop-overlay-icon" }),
                h("div", { class: "coda-drop-overlay-text" }, _('Drop file to open')))));
    }
    function show() {
        if (!overlay) {
            overlay = build();
            document.body.appendChild(overlay);
        }
        overlay.classList.add('is-visible');
    }
    DropFileOverlay.show = show;
    function hide() {
        if (overlay)
            overlay.classList.remove('is-visible');
    }
    DropFileOverlay.hide = hide;
})(DropFileOverlay || (DropFileOverlay = {}));

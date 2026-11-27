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
// A builder owns a core-side window when it carries a window id of its own
function builderHasOwnWindow(builder) {
    return builder.windowId !== null && builder.windowId !== undefined;
}
// The window id used to address the matching component on the core side
function resolveWindowId(builder) {
    if (builderHasOwnWindow(builder))
        return builder.windowId;
    if (window.mobileDialogId !== undefined)
        return window.mobileDialogId;
    if (window.sidebarId !== undefined)
        return window.sidebarId;
    return -1;
}
// A window is browser-only when it has no counterpart on the core side
function isBrowserOnlyWindow(builder) {
    return (!builderHasOwnWindow(builder) &&
        window.sidebarId === undefined &&
        window.mobileDialogId === undefined);
}
JSDialog.resolveWindowId = resolveWindowId;
JSDialog.isBrowserOnlyWindow = isBrowserOnlyWindow;

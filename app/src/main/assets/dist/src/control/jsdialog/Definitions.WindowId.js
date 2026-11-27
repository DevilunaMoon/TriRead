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
/*
 * Definitions.WindowId - Predefined special WindowId list used by JSDialog to
 *                        communicate with correct component on the core side.
 *                        Regular dialogs get automatically incremented positive,
 *                        non-zero values form the core. For special cases we use
 *                        0 - "main window"
 *                        negative numbers - converted by core into per-user ids
 */
// see core desktop/source/lib/init.cxx
var WindowId;
(function (WindowId) {
    WindowId[WindowId["Sidebar"] = -1] = "Sidebar";
    WindowId[WindowId["Notebookbar"] = -2] = "Notebookbar";
    WindowId[WindowId["Formulabar"] = -3] = "Formulabar";
    WindowId[WindowId["AddressInput"] = -4] = "AddressInput";
    WindowId[WindowId["QuickFind"] = -5] = "QuickFind";
    WindowId[WindowId["NotesPanel"] = -6] = "NotesPanel";
})(WindowId || (WindowId = {}));
var AutoCompleteDialogId;
(function (AutoCompleteDialogId) {
    AutoCompleteDialogId["Mention"] = "mentionPopup";
    AutoCompleteDialogId["FormulaUsagePopup"] = "formulausagePopup";
})(AutoCompleteDialogId || (AutoCompleteDialogId = {}));

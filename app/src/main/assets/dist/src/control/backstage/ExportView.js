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
 * Export view: a grid of cards, one per available download format. The
 * card label shows the file extension; clicking dispatches the format's
 * action to the backstage view, which routes it through the dispatcher
 * or a fallback download path.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function exportGrid(options, onExport) {
        return (h("div", { class: "backstage-formats-grid" }, options.map((option) => exportCard(option, onExport))));
    }
    BackstageTemplates.exportGrid = exportGrid;
    function exportCard(option, onExport) {
        const format = option.action.startsWith('downloadas-')
            ? option.action.substring('downloadas-'.length)
            : option.action.startsWith('export')
                ? option.action.substring('export'.length)
                : '';
        const extensionLabel = format ? format.toUpperCase() : '';
        return (h("div", { class: "backstage-format-card", onClick: () => onExport(option.action, option.command) },
            h("div", { class: "format-icon" }, extensionLabel),
            h("div", { class: "format-description" }, option.text)));
    }
})(BackstageTemplates || (BackstageTemplates = {}));

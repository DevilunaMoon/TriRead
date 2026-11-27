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
 * Home view: a row of the favorite templates and the blank documents, a "More templates" link,
 * and a table of recently opened documents. The view passes in already-resolved data plus click
 * handlers; this file owns the structure.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function homeTemplatesSection(props) {
        return (h(Fragment, null,
            h("div", { class: "backstage-home-templates-row" },
                props.favoriteTemplates.map((t) => BackstageTemplates.templateCard(t, () => props.onTemplateClick(t), {
                    favorite: props.favoriteState(t),
                })),
                props.blankTemplates.map((t) => BackstageTemplates.templateCard(t, () => props.onTemplateClick(t)))),
            h("div", { class: "backstage-home-more-templates" },
                h("div", { class: "backstage-home-divider" }),
                h("div", { class: "backstage-home-more-button", role: "button", tabindex: "0", "aria-label": _('More templates'), onClick: props.onMoreTemplatesClick }, _('More templates')))));
    }
    BackstageTemplates.homeTemplatesSection = homeTemplatesSection;
    function recentDocsTable(rows, onOpen) {
        return (h("table", { class: "backstage-recent-documents-table" },
            h("thead", { class: "backstage-recent-documents-header" },
                h("tr", { class: "backstage-recent-documents-header-row" },
                    h("th", { class: "backstage-recent-documents-header-cell" }, _('Name')),
                    h("th", { class: "backstage-recent-documents-header-cell" }, _('Modified Date')))),
            h("tbody", { class: "backstage-recent-documents-body" }, rows.map((r) => recentDocRow(r, onOpen)))));
    }
    BackstageTemplates.recentDocsTable = recentDocsTable;
    function recentDocRow(r, onOpen) {
        return (h("tr", { class: "backstage-recent-document-row", onClick: () => onOpen(r.uri) },
            h("td", { class: "backstage-recent-document-name-cell", id: `backstage-recent-document-${r.index}` },
                h("div", { class: "backstage-recent-document-content-wrapper" },
                    h("span", { class: `backstage-recent-document-icon ${r.iconClass}` }),
                    h("div", { class: "backstage-recent-document-text-wrapper" },
                        h("div", { class: "backstage-recent-document-name-text" }, r.fileName),
                        h("div", { class: "backstage-recent-document-path-text" },
                            h("span", { dir: "ltr" }, r.filePath))))),
            h("td", { class: "backstage-recent-document-time-cell" }, r.formattedTime)));
    }
})(BackstageTemplates || (BackstageTemplates = {}));

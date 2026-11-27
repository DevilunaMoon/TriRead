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
 * Small reusable backstage building blocks: section headers, the primary
 * action button used in dialogs, and the templates loading placeholder.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function sectionHeader(title, description) {
        return (h(Fragment, null,
            h("h2", { class: "backstage-content-title" }, title),
            description ? (h("p", { class: "backstage-content-description" }, description)) : null));
    }
    BackstageTemplates.sectionHeader = sectionHeader;
    function primaryButton(label, onClick) {
        return (h("button", { class: "backstage-property-button", onClick: onClick }, label));
    }
    BackstageTemplates.primaryButton = primaryButton;
    function templatesLoading() {
        return (h("div", { class: "backstage-templates-empty" },
            h("p", { class: "backstage-content-description" }, _('Loading templates…'))));
    }
    BackstageTemplates.templatesLoading = templatesLoading;
    // Backstage icons are embedded, not linked, so that the colouring works on the DOM.
    function inlineIcon(name) {
        const markup = BackstageSVGIcons[name];
        if (!markup)
            return null;
        const holder = document.createElement('div');
        holder.innerHTML = app.LOUtil.sanitize(markup, 'svg');
        return holder.firstElementChild;
    }
    BackstageTemplates.inlineIcon = inlineIcon;
    // A short note at the bottom of the backstage that confirms an action.
    function snackbar(text) {
        return (h("div", { class: "backstage-snackbar", role: "status" }, text));
    }
    BackstageTemplates.snackbar = snackbar;
    function emptyRecentDocs() {
        return (h("p", { class: "backstage-content-description" }, _('Recently opened documents will appear here')));
    }
    BackstageTemplates.emptyRecentDocs = emptyRecentDocs;
})(BackstageTemplates || (BackstageTemplates = {}));

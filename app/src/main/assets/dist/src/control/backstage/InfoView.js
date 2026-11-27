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
 * Document Info view: a column of Type/File Name/Pages/Mode property rows
 * with a button to open the full Document Properties dialog.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function infoPropertiesColumn(properties, onOpenProperties) {
        return (h("div", { class: "backstage-info-properties" },
            h("h3", { class: "backstage-section-header" }, _('Properties')),
            h("div", { class: "backstage-properties-list" }, properties
                .filter((p) => p.value)
                .map((p) => propertyItem(p.label, p.value))),
            BackstageTemplates.primaryButton(_('More Property Info'), onOpenProperties)));
    }
    BackstageTemplates.infoPropertiesColumn = infoPropertiesColumn;
    function propertyItem(label, value) {
        return (h("div", { class: "backstage-property-item" },
            h("div", { class: "property-label" }, label),
            h("div", { class: "property-value" }, value)));
    }
})(BackstageTemplates || (BackstageTemplates = {}));

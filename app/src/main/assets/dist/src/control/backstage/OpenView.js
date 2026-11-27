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
 * "Open" view: a row of large tiles for opening a document - one for the
 * local file picker, then a vertical separator, then one per registered
 * cloud provider. Below that, a divider with an "Add Cloud +" action on
 * the right. The view passes resolved tile data and click handlers; this
 * file owns only the structure.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function openView(props) {
        return (h(Fragment, null,
            BackstageTemplates.sectionHeader(_('Open'), _('Open a document from your computer or a cloud location.')),
            h("div", { class: "backstage-open-tiles-row" },
                openTile({
                    label: _('Open File from Computer'),
                    iconName: 'lc_open.svg',
                    onClick: props.onOpenLocal,
                }),
                h("div", { class: "backstage-open-tiles-separator", role: "separator", "aria-orientation": "vertical" }),
                props.cloudTiles.map(cloudProviderTile)),
            h("div", { class: "backstage-open-actions-row" },
                h("div", { class: "backstage-open-actions-divider" }),
                h("button", { type: "button", class: "backstage-open-add-cloud-button", onClick: props.onAddCloudClick }, _('Add Cloud +')))));
    }
    BackstageTemplates.openView = openView;
    function openTile(props) {
        const ariaLabel = props.subtitle
            ? `${props.label} (${props.subtitle})`
            : props.label;
        const cls = ['backstage-open-tile', props.extraClass]
            .filter(Boolean)
            .join(' ');
        return (h("div", { class: cls, role: "button", tabindex: props.inert ? -1 : 0, "aria-label": ariaLabel, "aria-hidden": props.inert ? 'true' : undefined, onClick: props.inert ? undefined : props.onClick },
            h("span", { class: ['backstage-open-tile-icon', props.iconClass]
                    .filter(Boolean)
                    .join(' '), "aria-hidden": "true" }, props.iconName
                ? BackstageTemplates.inlineIcon(props.iconName)
                : null),
            h("span", { class: "backstage-open-tile-label" }, props.label),
            props.subtitle ? (h("span", { class: "backstage-open-tile-sublabel" }, props.subtitle)) : null));
    }
    BackstageTemplates.openTile = openTile;
    function cloudProviderTile(t) {
        return (h("div", { class: "backstage-open-tile is-cloud-provider", role: "button", tabindex: "0", "aria-label": `${t.typeName} (${t.userName})`, onClick: t.onClick },
            h("span", { class: 'backstage-open-tile-icon ' +
                    BackstageCloudKinds.iconClasses(t.kind), "aria-hidden": "true" }),
            h("span", { class: "backstage-open-tile-label" }, t.typeName),
            h("span", { class: "backstage-open-tile-sublabel" }, t.userName),
            h("button", { type: "button", class: "backstage-open-tile-edit", "aria-label": _('Edit account'), title: _('Edit account'), onClick: (e) => {
                    e.stopPropagation();
                    t.onEdit();
                } }, BackstageTemplates.inlineIcon('lc_edit.svg'))));
    }
})(BackstageTemplates || (BackstageTemplates = {}));

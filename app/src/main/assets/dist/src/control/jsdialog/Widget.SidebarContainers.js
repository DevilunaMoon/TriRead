// @ts-strict-ignore
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
JSDialog.deck = function (parentContainer, data, builder) {
    var deck = window.L.DomUtil.create('div', 'deck ' + builder.options.cssClass, parentContainer);
    deck.id = data.id;
    deck.tabIndex = '-1';
    if (data.headerText) {
        deck.appendChild(h("div", { class: 'ui-panel-header ui-deck-header ' + builder.options.cssClass },
            h("h2", { class: 'ui-panel-title ' + builder.options.cssClass, id: data.id + '-header-label' }, data.headerText)));
    }
    for (var i = 0; i < data.children.length; i++) {
        builder.build(deck, [data.children[i]], undefined);
    }
    return false;
};
// builds the frame an overlay sidebar deck is made of
JSDialog.buildOverlaySidebarPanel = function (options) {
    const closeText = _('Close');
    const labelId = options.id + '-label';
    let content;
    let header;
    let closeWrapper;
    const container = (h("div", { class: 'ui-panel-container ' + options.cssClass, id: options.id },
        h("div", { class: 'ui-panel-header ' + options.cssClass, ref: (el) => {
                header = el;
            } },
            h("h2", { class: 'ui-panel-title ' + options.cssClass, id: labelId }, options.title),
            h("div", { class: "close-navigation-wrapper", ref: (el) => {
                    closeWrapper = el;
                } },
                h("button", { class: "close-navigation-button ui-panel-close-button", id: options.id + '-close-button', "aria-label": closeText, "data-cooltip": closeText, onClick: () => options.onClose(), ref: (el) => window.L.control.attachTooltipEventListener(el, options.map) }))),
        h("div", { class: 'ui-panel-content ' + options.cssClass, id: options.id + '-children', role: "region", "aria-labelledby": labelId, ref: (el) => {
                content = el;
            } })));
    return { container, header, closeWrapper, content };
};
// builds the single section of an overlay deck
function buildPanelWithHeaderAction(parentContainer, data, builder) {
    const { container, header, closeWrapper, content } = JSDialog.buildOverlaySidebarPanel({
        id: data.id,
        title: builder._cleanText(data.text),
        cssClass: builder.options.cssClass,
        map: builder.map,
        onClose: () => builder.map.sendUnoCommand(data.closeCommand),
    });
    // The panel keeps its options menu next to the close button, at the leading
    // side of the close button so the close button stays at the trailing edge.
    if (data.command) {
        const icon = window.L.DomUtil.create('div', 'ui-expander-icon-right ' + builder.options.cssClass);
        header.insertBefore(icon, closeWrapper);
        const moreOptionsText = data.text
            ? _('More options for {1}').replace('{1}', data.text)
            : '';
        builder._controlHandlers['toolitem'](icon, {
            type: 'toolitem',
            command: data.command,
            aria: { label: moreOptionsText, role: 'popup' },
            icon: app.LOUtil.getIconNameOfCommand('morebutton'),
            tooltip: moreOptionsText,
        }, // FIXME: use toolitem JSON type
        builder);
    }
    if (data.name)
        container.classList.add(data.name);
    if (data.hidden === true)
        container.classList.add('hidden');
    parentContainer.appendChild(container);
    builder.build(content, data.children, undefined);
}
JSDialog.panel = function (parentContainer, data, builder) {
    if (data.closeCommand) {
        buildPanelWithHeaderAction(parentContainer, data, builder);
        return false;
    }
    var expanderData = data;
    expanderData.type = 'expander';
    expanderData.children = [{ text: data.text }].concat(data.children);
    builder._controlHandlers['expander'](parentContainer, expanderData, builder, () => {
        /*do nothing*/
    });
    var expander = $(parentContainer).children('#' + expanderData.id);
    if (data.name)
        window.L.DomUtil.addClass(expander.get(0), data.name);
    if (expanderData.hidden === true)
        expander.hide();
    if (expanderData.command) {
        var iconParent = expander.children('.ui-expander').get(0);
        var icon = window.L.DomUtil.create('div', 'ui-expander-icon-right ' + builder.options.cssClass, iconParent);
        const moreOptionsText = expanderData.children[0].text
            ? _('More options for {1}').replace('{1}', expanderData.children[0].text)
            : '';
        builder._controlHandlers['toolitem'](icon, {
            type: 'toolitem',
            command: expanderData.command,
            aria: { label: moreOptionsText, role: 'popup' },
            icon: app.LOUtil.getIconNameOfCommand('morebutton'),
            tooltip: moreOptionsText,
        }, // FIXME: use toolitem JSON type
        builder);
    }
    return false;
};

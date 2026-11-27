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
 * Backstage chrome: the top header bar (title + close button) and the
 * left sidebar (back-to-document button + tab list). The view passes in
 * tab configs and click handlers; this file owns only the structure.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function shell(props) {
        const containerClass = props.isStarterMode
            ? 'backstage-view hidden is-starter-mode'
            : 'backstage-view hidden';
        return (h("div", { class: containerClass, id: "backstage-view", tabindex: "-1" },
            header({
                isStarterMode: props.isStarterMode,
                closeButtonEnabled: props.closeButtonEnabled,
                onClose: props.onClose,
            }),
            h("div", { class: "backstage-main-wrapper" },
                sidebar({
                    isStarterMode: props.isStarterMode,
                    tabs: props.tabs,
                    onTabClick: props.onTabClick,
                    onBackClick: props.onBackClick,
                    saveTabRef: props.saveTabRef,
                }),
                h("div", { class: "backstage-content", ref: props.contentAreaRef }))));
    }
    BackstageTemplates.shell = shell;
    function header(props) {
        return (h("div", { class: "backstage-header" },
            h("span", { class: "backstage-header-title" }, "Collabora Office"),
            props.isStarterMode || !props.closeButtonEnabled
                ? null
                : closeButton(props.onClose)));
    }
    BackstageTemplates.header = header;
    function closeButton(onClose) {
        return (h("div", { class: "backstage-header-close", role: "button", tabindex: "0", "aria-label": _('Close backstage'), title: _('Close backstage'), onClick: onClose },
            h("span", { class: "backstage-header-close-icon", "aria-hidden": "true" })));
    }
    function sidebar(props) {
        return (h("div", { class: "backstage-sidebar", role: "tablist" },
            props.isStarterMode ? null : backButton(props.onBackClick),
            h("div", { class: "backstage-sidebar-tabs" }, props.tabs
                .filter((c) => c.visible !== false)
                .map((c) => tabElement(c, props)))));
    }
    BackstageTemplates.sidebar = sidebar;
    function backButton(onClick) {
        return (h("div", { class: "backstage-sidebar-back", role: "button", tabindex: "0", "aria-label": _('Back to document'), title: _('Back to document'), onClick: onClick },
            h("span", { class: "backstage-sidebar-back-icon", "aria-hidden": "true" })));
    }
    function tabElement(config, props) {
        const isSeparator = config.type === 'separator';
        return (h("div", { class: `backstage-sidebar-item${isSeparator ? ' separator' : ''}`, id: `backstage-${config.id}`, role: isSeparator ? 'separator' : 'button', tabindex: isSeparator ? undefined : '0', ref: (el) => {
                if (config.id === 'save')
                    props.saveTabRef(el);
            }, onClick: () => !isSeparator && props.onTabClick(config) },
            config.icon ? (h("span", { class: "backstage-sidebar-icon", "aria-hidden": "true" }, BackstageTemplates.inlineIcon(config.icon))) : null,
            h("span", null, config.label)));
    }
})(BackstageTemplates || (BackstageTemplates = {}));

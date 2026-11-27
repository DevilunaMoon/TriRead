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
function _chipIsLCIcon(str) {
    return typeof str === 'string' && str.indexOf('lc_') === 0;
}
JSDialog.chip = function (parentContainer, data, builder) {
    const container = window.L.DomUtil.create('div', 'ui-chip ' + builder.options.cssClass, parentContainer);
    container.id = data.id;
    const main = window.L.DomUtil.create('button', 'ui-chip-main ' + builder.options.cssClass, container);
    main.type = 'button';
    main.id = data.id + '-main';
    main.setAttribute('tabindex', '0');
    main.setAttribute('aria-pressed', data.pressed === true ? 'true' : 'false');
    if (data.icon) {
        const iconSpan = window.L.DomUtil.create('span', 'ui-chip-icon', main);
        if (_chipIsLCIcon(data.icon)) {
            const img = window.L.DomUtil.create('img', '', iconSpan);
            app.LOUtil.setImage(img, app.LOUtil.getIconNameOfIcon(data.icon) || data.icon, builder.map);
            img.alt = '';
        }
        else {
            iconSpan.textContent = data.icon;
        }
    }
    const textSpan = window.L.DomUtil.create('span', 'ui-chip-text', main);
    textSpan.textContent = builder._cleanText(data.text || '');
    const ariaLabel = data.aria && data.aria.label;
    if (ariaLabel) {
        main.setAttribute('aria-label', ariaLabel);
    }
    const isDisabled = data.enabled === false;
    if (isDisabled) {
        container.setAttribute('disabled', 'true');
        main.setAttribute('disabled', 'true');
        main.setAttribute('aria-disabled', 'true');
    }
    main.onclick = () => {
        if (isDisabled)
            return;
        builder.callback('chip', 'click', container, undefined, builder);
    };
    if (data.actions && data.actions.length > 0) {
        for (const action of data.actions) {
            const actionBtn = window.L.DomUtil.create('button', 'ui-chip-action ' + builder.options.cssClass, container);
            actionBtn.type = 'button';
            actionBtn.id = action.id;
            actionBtn.setAttribute('tabindex', '0');
            if (action.image) {
                const img = window.L.DomUtil.create('img', '', actionBtn);
                if (_chipIsLCIcon(action.image)) {
                    app.LOUtil.setImage(img, action.image, builder.map);
                }
                else {
                    img.src = action.image;
                }
                img.alt = '';
            }
            else if (action.text) {
                actionBtn.textContent = builder._cleanText(action.text);
            }
            if (action.aria && action.aria.label) {
                actionBtn.setAttribute('aria-label', action.aria.label);
            }
            const actionDisabled = action.enabled === false;
            if (actionDisabled) {
                actionBtn.setAttribute('disabled', 'true');
                actionBtn.setAttribute('aria-disabled', 'true');
            }
            const actionId = action.id;
            actionBtn.onclick = () => {
                if (actionDisabled)
                    return;
                builder.callback('pushbutton', 'click', { id: actionId }, undefined, builder);
            };
        }
    }
    return false;
};

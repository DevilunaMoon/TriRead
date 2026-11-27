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
function createSlideLayoutButton(id, label) {
    const button = document.createElement('div');
    button.className = 'slidelayout-button';
    button.id = id;
    button.textContent = label;
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    return button;
}
function createSlideLayoutEntryWidget(data, builder) {
    const container = document.createElement('div');
    container.className = 'slidelayout-popup-container';
    // Build the grid first
    const gridData = data.gridContent; // The grid from generateLayoutPopupGrid
    const gridContainer = document.createElement('div');
    builder.build(gridContainer, [gridData], false);
    container.appendChild(gridContainer);
    const hr = document.createElement('hr');
    hr.className = 'jsdialog ui-separator horizontal';
    container.appendChild(hr);
    const overview = createSlideLayoutButton('newcanvasslide', _('Overview'));
    overview.addEventListener('click', () => {
        builder.map.sendUnoCommand('.uno:InsertCanvasSlide'); // or your command
        builder.callback('dialog', 'close', { id: data.id }, null);
    });
    container.appendChild(overview);
    if (app.impress.isSlideImportSupported()) {
        const importSlides = createSlideLayoutButton('importslides-entry', _('Import your slides'));
        const icon = document.createElement('img');
        icon.alt = '';
        app.LOUtil.setImage(icon, 'plus.svg', builder.map);
        importSlides.prepend(icon);
        importSlides.addEventListener('click', () => {
            builder.callback('dialog', 'close', { id: data.id }, null);
            app.dispatcher.dispatch('importslides');
        });
        container.appendChild(importSlides);
    }
    return container;
}
JSDialog.slideLayoutEntry = function (parentContainer, data, builder) {
    const widget = createSlideLayoutEntryWidget(data, builder);
    parentContainer.appendChild(widget);
    return false;
};

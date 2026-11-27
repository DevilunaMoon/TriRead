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
function createPageSizeEntryWidget(data, builder) {
    const sizes = data.options || [];
    const container = document.createElement('div');
    container.className = 'jsdialog ui-grid';
    container.setAttribute('tabindex', '-1');
    const list = document.createElement('div');
    list.className = 'jsdialog pagesize-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('tabindex', '-1');
    container.appendChild(list);
    const map = builder.map;
    sizes.forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'ui-combobox-entry jsdialog ui-grid-cell';
        item.id = opt.id;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.tabIndex = 0;
        item.addEventListener('click', (evt) => {
            map.sendUnoCommand(opt.uno);
            builder.callback('dialog', 'close', { id: data.id }, null);
        });
        item.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                item.click();
            }
        });
        const text = document.createElement('span');
        text.textContent = opt.text;
        item.appendChild(text);
        list.appendChild(item);
    });
    const hr = document.createElement('hr');
    hr.className = 'jsdialog ui-separator horizontal';
    hr.setAttribute('tabindex', '-1');
    container.appendChild(hr);
    const moreSizeContainer = document.createElement('div');
    moreSizeContainer.className = 'ui-combobox-entry jsdialog ui-grid-cell';
    moreSizeContainer.id = 'page-size-more';
    moreSizeContainer.setAttribute('aria-haspopup', 'dialog');
    moreSizeContainer.setAttribute('role', 'button');
    moreSizeContainer.tabIndex = 0;
    moreSizeContainer.addEventListener('click', (evt) => {
        map.sendUnoCommand('.uno:PageFormatDialog');
        builder.callback('dialog', 'close', { id: data.id }, null);
    });
    moreSizeContainer.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
            moreSizeContainer.click();
        }
    });
    const text = document.createElement('span');
    text.textContent = _('More Paper Sizes...');
    moreSizeContainer.appendChild(text);
    container.appendChild(moreSizeContainer);
    return container;
}
JSDialog.pageSizeEntry = function (parentContainer, data, builder) {
    const element = createPageSizeEntryWidget(data, builder);
    parentContainer.appendChild(element);
    // Focus first item
    const firstEntry = element.querySelector('.ui-combobox-entry');
    if (firstEntry) {
        firstEntry.focus();
        firstEntry.classList.add('selected');
        firstEntry.setAttribute('aria-selected', 'true');
        data.initialSelectedId = firstEntry.id;
    }
    return false;
};

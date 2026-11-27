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
function KeyboardRadioGroupNavigation(event, currentElement) {
    switch (event.key) {
        case 'ArrowRight':
            selectRadio(currentElement, adjacentEntry(currentElement, 'next'));
            event.preventDefault();
            event.stopPropagation();
            break;
        case 'ArrowLeft':
            selectRadio(currentElement, adjacentEntry(currentElement, 'previous'));
            event.preventDefault();
            event.stopPropagation();
            break;
        case 'ArrowDown':
            selectRadio(currentElement, entryOneRowAway(currentElement, 'next'));
            event.preventDefault();
            event.stopPropagation();
            break;
        case 'ArrowUp':
            selectRadio(currentElement, entryOneRowAway(currentElement, 'previous'));
            event.preventDefault();
            event.stopPropagation();
            break;
        default:
            break;
    }
}
function adjacentEntry(currentElement, direction) {
    return JSDialog.FindNextFocusableSiblingElement(currentElement, direction);
}
function columnCount(container) {
    const tracks = window.getComputedStyle(container).gridTemplateColumns;
    if (!tracks || tracks === 'none')
        return 1;
    return tracks.split(' ').filter((track) => track.length > 0).length;
}
function entryOneRowAway(currentElement, direction) {
    const container = currentElement.parentElement;
    if (!container)
        return null;
    const cells = container.children;
    const index = Array.prototype.indexOf.call(cells, currentElement);
    if (index < 0)
        return null;
    const columns = columnCount(container);
    const target = direction === 'next' ? index + columns : index - columns;
    if (target < 0 || target >= cells.length)
        return null;
    const candidate = cells[target];
    return JSDialog.IsFocusable(candidate) ? candidate : null;
}
function selectRadio(currentElement, siblingElement) {
    if (siblingElement) {
        currentElement.setAttribute('aria-checked', 'false');
        currentElement.setAttribute('tabindex', '-1');
        currentElement.classList.remove('selected');
        siblingElement.setAttribute('aria-checked', 'true');
        siblingElement.setAttribute('tabindex', '0');
        siblingElement.classList.add('selected');
        siblingElement.focus();
    }
}
JSDialog.KeyboardRadioGroupNavigation = function (container) {
    container.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        if (!JSDialog.IsTextInputField(activeElement)) {
            KeyboardRadioGroupNavigation(event, activeElement);
        }
    });
};

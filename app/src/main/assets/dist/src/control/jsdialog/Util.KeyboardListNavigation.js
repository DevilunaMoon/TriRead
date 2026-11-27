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
function KeyboardListNavigation(event, currentElement) {
    switch (event.key) {
        case 'ArrowDown':
            moveToFocusableEntry(currentElement, 'next');
            event.preventDefault();
            break;
        case 'ArrowUp':
            moveToFocusableEntry(currentElement, 'previous');
            event.preventDefault();
            break;
        default:
            break;
    }
}
// Helper function to move focus and apply selection class
function moveToFocusableEntry(currentElement, direction) {
    const updateAriaSelected = (elem, value) => {
        if (elem.hasAttribute('aria-selected')) {
            elem.setAttribute('aria-selected', value);
        }
    };
    const updateAriaActiveDescendant = (elem) => {
        const listbox = elem.closest('[role="listbox"]');
        if (listbox && elem.id) {
            listbox.setAttribute('aria-activedescendant', elem.id);
        }
    };
    // If the current element is focused but not selected, add 'selected' class and return
    if (document.activeElement === currentElement &&
        !currentElement.classList.contains('selected') &&
        direction === 'next') {
        currentElement.classList.add('selected');
        updateAriaSelected(currentElement, 'true');
        updateAriaActiveDescendant(currentElement);
        return;
    }
    const siblingElement = JSDialog.FindNextFocusableSiblingElement(currentElement, direction);
    if (siblingElement) {
        siblingElement.focus();
        siblingElement.classList.add('selected');
        updateAriaSelected(siblingElement, 'true');
        updateAriaActiveDescendant(siblingElement);
        currentElement.classList.remove('selected');
        updateAriaSelected(currentElement, 'false');
    }
}
JSDialog.KeyboardListNavigation = function (container) {
    container.addEventListener('keydown', (event) => {
        const allowedKeys = ['ArrowDown', 'ArrowUp'];
        if (!allowedKeys.includes(event.key)) {
            return;
        }
        const activeElement = document.activeElement;
        if (!JSDialog.IsTextInputField(activeElement)) {
            KeyboardListNavigation(event, activeElement);
        }
    });
};

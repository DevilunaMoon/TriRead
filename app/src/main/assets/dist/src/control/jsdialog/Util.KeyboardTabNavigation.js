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
function isTabVisible(tab) {
    return !tab.classList.contains('hidden');
}
function findNextVisibleTab(tabs, currentIndex, backwards) {
    const diff = backwards ? -1 : 1;
    const total = tabs.length;
    for (let i = 1; i <= total; i++) {
        const nextIndex = (currentIndex + diff * i + total) % total;
        const nextTab = tabs[nextIndex];
        if (isTabVisible(nextTab)) {
            return nextTab;
        }
    }
    // Fallback to current tab if no visible one is found (shouldn't happen)
    return tabs[currentIndex];
}
function moveFocusToPreviousTab(tabs, currentIndex) {
    const currentTab = tabs[currentIndex];
    currentTab.setAttribute('aria-selected', 'false');
    currentTab.setAttribute('tabindex', '-1');
    const nextTab = findNextVisibleTab(tabs, currentIndex, true);
    nextTab.setAttribute('aria-selected', 'true');
    nextTab.removeAttribute('tabindex');
    nextTab.click();
    nextTab.focus(); // Prevent document from taking focus
}
function moveFocusToNextTab(tabs, currentIndex) {
    const currentTab = tabs[currentIndex];
    currentTab.setAttribute('aria-selected', 'false');
    currentTab.setAttribute('tabindex', '-1');
    const nextTab = findNextVisibleTab(tabs, currentIndex, false);
    nextTab.setAttribute('aria-selected', 'true');
    nextTab.removeAttribute('tabindex');
    nextTab.click();
    nextTab.focus(); // Prevent document from taking focus
}
function moveFocusIntoTabPage(contentDivs, currentTab) {
    if (!currentTab.hasAttribute('aria-controls')) {
        console.warn('Current tab has no aria-controls attribute');
        return false;
    }
    const controlledId = currentTab.getAttribute('aria-controls');
    const controlledDiv = contentDivs.find((div) => div.id === controlledId);
    if (!controlledDiv)
        return false;
    const firstFocusableElement = JSDialog.FindFocusableWithin(controlledDiv, 'next');
    if (!firstFocusableElement)
        return false;
    firstFocusableElement.focus();
    return true;
}
function handleTabKeydown(event, tabs, contentDivs, vertical) {
    const currentTab = event.currentTarget;
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1)
        return;
    // Per the WAI-ARIA tabs pattern the axis that moves between tabs follows
    // the rail orientation: Up/Down for a vertical rail, Left/Right for a
    // horizontal row. The cross axis key enters the panel.
    const prevTabKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextTabKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const enterPanelKey = vertical ? 'ArrowRight' : 'ArrowDown';
    switch (event.key) {
        case prevTabKey:
            moveFocusToPreviousTab(tabs, currentIndex);
            event.preventDefault();
            break;
        case nextTabKey:
            moveFocusToNextTab(tabs, currentIndex);
            event.preventDefault();
            break;
        case enterPanelKey:
        case 'PageDown':
            if (moveFocusIntoTabPage(contentDivs, currentTab))
                event.preventDefault();
            break;
        case 'Tab':
            if (event.shiftKey)
                break;
            if (moveFocusIntoTabPage(contentDivs, currentTab))
                event.preventDefault();
            break;
        case 'Home': {
            const firstIndex = 0;
            var firstTab = tabs[firstIndex];
            if (!isTabVisible(firstTab))
                firstTab = findNextVisibleTab(tabs, firstIndex, false);
            firstTab.focus();
            event.preventDefault();
            break;
        }
        case 'End': {
            const lastIndex = tabs.length - 1;
            var lastTab = tabs[lastIndex];
            if (!isTabVisible(lastTab))
                lastTab = findNextVisibleTab(tabs, lastIndex, true);
            lastTab.focus();
            event.preventDefault();
            break;
        }
        case 'Escape':
            if (window.app && window.app.map && window.app.map.focus) {
                window.app.map.focus();
            }
            break;
    }
}
JSDialog.KeyboardTabNavigation = function (tabs, contentDivs, vertical) {
    // Add keydown listeners to all tabs
    tabs.forEach((tab) => {
        tab.addEventListener('keydown', (event) => {
            handleTabKeydown(event, tabs, contentDivs, vertical === true);
        });
    });
};

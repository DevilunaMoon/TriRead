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
class CompactViewAccessibility {
    constructor() {
        this.initialized = false;
        this.accessKeysInitialized = false;
        this.combination = null;
        this.infoBoxes = [];
        this.contentList = [];
        this.fixedContentList = [];
        this.mayShowInfoBoxes = false;
        this.accessibilityInputElement = null;
    }
    initialize() {
        if (!window.mode.isDesktop())
            return;
        if (!this.initialized) {
            this.initAccessibilityInputElement();
            this.initialized = true;
        }
    }
    initAccessibilityInputElement() {
        this.accessibilityInputElement = document.createElement('input');
        // type='submit' prevents screen readers from announcing "editable blank"
        this.accessibilityInputElement.type = 'submit';
        // role='menubar' prevents screen readers from announcing "Submit button"
        this.accessibilityInputElement.setAttribute('role', 'menubar');
        this.accessibilityInputElement.style.width = '0';
        this.accessibilityInputElement.style.height = '0';
        this.accessibilityInputElement.id = 'compactViewAccessibilityInput';
        this.accessibilityInputElement.onblur = this.hideInfoBoxes.bind(this);
        this.accessibilityInputElement.onkeydown = this.onInputKeyDown.bind(this);
        this.accessibilityInputElement.onkeyup = this.onInputKeyUp.bind(this);
        this.accessibilityInputElement.autocomplete = 'off';
        const container = document.createElement('div');
        container.style.width = '0';
        container.style.height = '0';
        container.style.overflow = 'hidden';
        container.appendChild(this.accessibilityInputElement);
        document.body.insertBefore(container, document.body.firstChild);
    }
    collectMenuItems() {
        const menubar = app.map.menubar;
        if (!menubar)
            return;
        const menuItems = menubar.options[app.map.getDocType()];
        if (!Array.isArray(menuItems))
            return;
        for (const item of menuItems) {
            if (!item.accessibility?.combination || !item.id)
                continue;
            if (!document.getElementById('menu-' + item.id))
                continue;
            this.contentList.push({
                id: 'menu-' + item.id,
                combination: item.accessibility.combination,
                focusBack: false,
            });
        }
    }
    addInfoBox(anchorElement, combination) {
        if (!anchorElement || anchorElement.offsetParent === null)
            return null;
        const infoBox = document.createElement('div');
        infoBox.classList.add('accessibility-info-box');
        infoBox.textContent = combination;
        const rect = anchorElement.getBoundingClientRect();
        infoBox.style.top = rect.bottom - 5 + 'px';
        infoBox.style.left = rect.left + 'px';
        document.body.appendChild(infoBox);
        return infoBox;
    }
    removeAllInfoBoxes() {
        const boxes = document.getElementsByClassName('accessibility-info-box');
        for (let i = boxes.length - 1; i >= 0; i--) {
            document.body.removeChild(boxes[i]);
        }
        this.infoBoxes = [];
    }
    createContentList() {
        this.contentList = [];
        const topToolbar = app.map.topToolbar;
        if (topToolbar) {
            const items = topToolbar.getToolItems();
            if (items)
                this.collectItems(items);
        }
        const formulabar = app.map.formulabar;
        if (formulabar) {
            const formulaItems = formulabar.getFormulaItems();
            if (formulaItems)
                this.collectItems(formulaItems);
        }
        const addressInput = app.map.addressInputField;
        if (addressInput) {
            const addressItems = addressInput.getAddressItems();
            if (addressItems)
                this.collectItems(addressItems);
        }
        this.addFixedElements();
    }
    findElement(id) {
        if (id.startsWith('menu-'))
            return document.getElementById(id);
        const modelId = document.querySelector(`[modelid="${id}"]`);
        if (modelId)
            return modelId;
        return document.getElementById(id);
    }
    cleanId(id) {
        const separatorPos = id.indexOf(':');
        if (separatorPos === -1)
            return id;
        return id.substring(0, separatorPos);
    }
    collectItems(items) {
        for (const item of items) {
            if (item.accessibility?.combination && item.id) {
                this.contentList.push({
                    id: this.cleanId(item.id),
                    combination: item.accessibility.combination,
                    focusBack: item.accessibility.focusBack !== false,
                });
            }
            if (item.children)
                this.collectItems(item.children);
        }
    }
    addFixedElements() {
        this.fixedContentList = [];
        const containerList = ['viewModeDropdownButton', 'userListHeader'];
        for (const containerId of containerList) {
            const container = document.getElementById(containerId);
            if (!container)
                continue;
            const buttons = container.querySelectorAll('button');
            for (const button of Array.from(buttons)) {
                if (button.accessKey && button.id) {
                    this.fixedContentList.push({
                        id: button.id,
                        combination: button.accessKey,
                        focusBack: true,
                    });
                }
            }
        }
    }
    addInfoBoxesForItems(items) {
        for (const item of items) {
            const anchor = this.findElement(item.id);
            if (!anchor)
                continue;
            anchor.accessKey = item.combination;
            const infoBox = this.addInfoBox(anchor, item.combination);
            if (infoBox)
                this.infoBoxes.push(infoBox);
        }
    }
    showInfoBoxes() {
        this.removeAllInfoBoxes();
        if (!this.accessKeysInitialized) {
            this.createContentList();
            this.collectMenuItems();
            this.accessKeysInitialized = true;
        }
        this.addInfoBoxesForItems(this.contentList);
        this.addInfoBoxesForItems(this.fixedContentList);
        document.body.classList.add('activate-info-boxes');
        // Focus the hidden input to capture subsequent key events
        this.accessibilityInputElement?.focus();
    }
    hideInfoBoxes() {
        this.combination = null;
        this.removeAllInfoBoxes();
        document.body.classList.remove('activate-info-boxes');
        // Clear the input to reset the state for the next Alt press
        if (this.accessibilityInputElement) {
            this.accessibilityInputElement.value = '';
        }
    }
    focusToMap() {
        this.hideInfoBoxes();
        app.map.focus();
    }
    filterInfoBoxes() {
        const boxes = document.getElementsByClassName('accessibility-info-box');
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (this.combination && !box.textContent?.startsWith(this.combination)) {
                box.classList.add('filtered_out');
            }
            else {
                box.classList.remove('filtered_out');
            }
        }
    }
    isAllFilteredOut() {
        const visible = document.querySelectorAll('.accessibility-info-box:not(.filtered_out)');
        return visible.length === 0;
    }
    findMatchingItem() {
        if (!this.combination)
            return null;
        for (const item of this.contentList.concat(this.fixedContentList)) {
            if (item.combination !== this.combination)
                continue;
            const element = this.findElement(item.id);
            if (element && element.offsetParent !== null)
                return item;
        }
        return null;
    }
    findFirstSubmenuItem(element) {
        const submenu = element.querySelector(':scope > ul');
        if (!submenu)
            return null;
        const firstSubmenuItem = submenu.querySelector('li > a');
        if (!firstSubmenuItem)
            return null;
        return firstSubmenuItem;
    }
    activateItem(item) {
        const element = this.findElement(item.id);
        if (!element)
            return;
        // Menu elem
        if (element.closest('#main-menu')) {
            const menuItem = element.querySelector('a');
            if (menuItem) {
                menuItem.click();
                const firstSubmenuItem = this.findFirstSubmenuItem(element);
                firstSubmenuItem?.focus();
            }
            this.hideInfoBoxes();
            return;
        }
        // Combobox
        const input = element.querySelector('input');
        if (input) {
            this.hideInfoBoxes();
            input.focus();
            return;
        }
        // Menu button or regular button
        const arrow = element.querySelector('.arrowbackground');
        const button = element.querySelector('button.unobutton');
        const target = arrow ?? button ?? element;
        target.click();
        if (item.focusBack)
            this.focusToMap();
    }
    onInputKeyDown(event) {
        // Hide boxes on Ctrl to allow normal keyboard shortcuts
        if (event.ctrlKey) {
            this.hideInfoBoxes();
        }
        if (event.key === 'Tab') {
            event.preventDefault();
        }
    }
    onInputKeyUp(event) {
        const key = event.key.toUpperCase();
        event.preventDefault();
        event.stopPropagation();
        if (key === 'ESCAPE' || key === 'ALT') {
            if (this.combination === null) {
                this.focusToMap();
            }
            else {
                this.hideInfoBoxes();
            }
            return;
        }
        // Ignore shift alone
        if (key === 'SHIFT')
            return;
        // Focus first menu item
        if (key === 'TAB') {
            const firstMenuItem = document.querySelector('#main-menu > li > a[tabindex="0"]');
            if (firstMenuItem) {
                this.hideInfoBoxes();
                firstMenuItem.focus();
            }
            return;
        }
        // Append key to combination
        if (this.combination === null) {
            this.combination = key;
        }
        else {
            this.combination += key;
        }
        // Check for an exact match first
        const matched = this.findMatchingItem();
        if (matched) {
            this.activateItem(matched);
            return;
        }
        // Filter the visible boxes to show only those still matching
        this.filterInfoBoxes();
        // We checked the pressed key against available combinations
        // If there is no match, focus back to map
        if (this.isAllFilteredOut()) {
            this.focusToMap();
        }
    }
    onDocumentKeyDown(event) {
        if (document.body.dataset.userinterfacemode !== 'classic')
            return;
        if (app.map &&
            app.map.backstageView &&
            app.map.backstageView.isOpen &&
            app.map.backstageView.isOpen())
            return;
        this.mayShowInfoBoxes = event.key.toUpperCase() === 'ALT';
    }
    // A mouse press while Alt is held makes it an Alt+mouse action, like Alt-drag,
    // so releasing Alt afterwards does not show the info boxes.
    onDocumentMouseDown() {
        this.mayShowInfoBoxes = false;
    }
    onDocumentKeyUp(event) {
        if (document.body.dataset.userinterfacemode !== 'classic')
            return;
        if (app.map &&
            app.map.backstageView &&
            app.map.backstageView.isOpen &&
            app.map.backstageView.isOpen())
            return;
        if (app.map && app.map.jsdialog && app.map.jsdialog.hasDialogOpened())
            return;
        const key = event.key.toUpperCase();
        if (key === 'ALT') {
            if (!this.mayShowInfoBoxes)
                return;
            if (this.infoBoxes.length > 0) {
                this.focusToMap();
            }
            else {
                this.showInfoBoxes();
            }
        }
        else if (key !== 'SHIFT') {
            // on Mac holding Option will send letter (for special characters) only
            // to focused editor, info boxes flag will not be cleared so do it now
            this.mayShowInfoBoxes = false;
        }
    }
}
app.UI.compactViewAccessibility = new CompactViewAccessibility();

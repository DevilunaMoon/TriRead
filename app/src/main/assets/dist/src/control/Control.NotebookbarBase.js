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
/*
 * Control.NotebookbarBase - component for tabbed menu on the top of application
 */
class NotebookbarBase extends JSDialogComponent {
    constructor(map, impl) {
        super(map, 'Notebookbar', 'notebookbar');
        /// reference to old JS Notebookbar
        this.impl = null;
        /// rebuilds the style box at the new density so the previews are re-rendered
        this.dpiListener = new DPIChangeListener(() => {
            this.reloadStylesView();
        });
        this.impl = impl;
        this.createBuilder();
        this.impl.setBuilder(this.builder, this.model);
        this.map.addControl(this.impl);
        this.registerMessageHandlers();
    }
    // when we show the UI
    onAdd() {
        this.setupContainer(undefined);
        this.impl.create(this.container);
        if (this.builder) {
            this.map.on('commandstatechanged', this.builder.onCommandStateChanged, this.builder);
        }
        this.dpiListener.start();
    }
    // when we hide the UI
    onRemove() {
        if (this.builder) {
            this.map.off('commandstatechanged', this.builder.onCommandStateChanged, this.builder);
        }
        this.dpiListener.stop();
        if (this.impl)
            this.impl.onRemove();
    }
    onCallback(objectType, eventType, object, data, builder) {
        if (this.impl && this.impl.onCallback) {
            const consumed = this.impl.onCallback(objectType, eventType, object, data, builder);
            if (consumed)
                return;
        }
        return this.builder?._defaultCallbackHandler(objectType, eventType, object, data, builder);
    }
    createBuilder() {
        this.builder = new window.L.control.notebookbarBuilder({
            windowId: WindowId.Notebookbar,
            mobileWizard: this.impl,
            map: this.map,
            cssClass: 'notebookbar',
            useSetTabs: true,
            suffix: 'notebookbar',
            callback: this.onCallback.bind(this),
        });
    }
    setupContainer(parentContainer) {
        // remove old toolbar
        let toolbar = window.L.DomUtil.get('toolbar-up');
        if (toolbar)
            toolbar.remove();
        // create toolbar from template
        const toolbarLogo = document.getElementById('toolbar-logo');
        if (toolbarLogo)
            toolbarLogo.after(this.map.toolbarUpTemplate.cloneNode(true));
        toolbar = window.L.DomUtil.get('toolbar-up');
        this.container = window.L.DomUtil.create('div', 'notebookbar-scroll-wrapper', toolbar);
    }
    onJSUpdate(e) {
        if (e.data &&
            e.data.jsontype === this.allowedJsonType &&
            e.data.control &&
            this.impl?.onCoreWidgetUpdate?.(e.data.control))
            return true;
        if (super.onJSUpdate(e)) {
            this.impl?.setInitialized(true);
            return true;
        }
        return false;
    }
    reloadStylesView() {
        const widgetData = this.model.getById('stylesview');
        if (!widgetData || !this.builder)
            return;
        if (this.container)
            this.builder.updateWidget(this.container, widgetData);
    }
    onJSAction(e) {
        if (super.onJSAction(e)) {
            this.impl?.setInitialized(true);
            return true;
        }
        return false;
    }
    /// used to get full model
    getFullJSON() {
        return this.impl?.getFullJSON();
    }
    // shortcuts
    /// used to get shortcut items
    getDefaultToolItems() {
        return this.impl?.getDefaultToolItems();
    }
    insertButtonToShortcuts(button) {
        this.impl?.insertButtonToShortcuts(button);
    }
    reloadShortcutsBar() {
        this.impl?.reloadShortcutsBar();
    }
    showNotebookbarCommand(commandId, show) {
        return this.impl?.showNotebookbarCommand(commandId, show);
    }
    // tabs
    getTabs() {
        return this.impl?.getTabs();
    }
    setTabs(tabs) {
        this.impl?.setTabs();
    }
    showTabs() {
        this.impl?.showTabs();
    }
    hideTabs() {
        this.impl?.hideTabs();
    }
    selectTab(tabName) {
        this.impl?.selectTab(tabName);
    }
    refreshContextTabsVisibility() {
        this.impl?.refreshContextTabsVisibility();
    }
    // customization
    showItem(id, show) {
        return this.impl?.showItem(id /* no show used */);
    }
    hideItem(id) {
        return this.impl?.hideItem(id);
    }
}
JSDialog.NotebookbarBase = function (map, impl) {
    return new NotebookbarBase(map, impl);
};

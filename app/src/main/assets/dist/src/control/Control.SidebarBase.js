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
/*
 * Control.SidebarBase
 */
var SidebarType;
(function (SidebarType) {
    SidebarType["Sidebar"] = "sidebar";
    SidebarType["Navigator"] = "navigator";
    SidebarType["QuickFind"] = "quickfind";
    SidebarType["Notebookbar"] = "notebookbar";
    SidebarType["Cleanup"] = "cleanup";
})(SidebarType || (SidebarType = {}));
class SidebarBase extends JSDialogComponent {
    constructor(map, type) {
        super(map, type, type);
        this.resizeTaskId = null;
        this.type = type;
        this.onAdd(map);
    }
    createBuilder() {
        this.builder = new window.L.control.jsDialogBuilder({
            mobileWizard: this,
            map: this.map,
            windowId: WindowId.Sidebar,
            cssClass: `jsdialog sidebar`,
            useScrollAnimation: false,
            suffix: 'sidebar',
            callback: this.callback.bind(this),
        });
    }
    setupContainer(parentContainer) {
        if (!this.container) {
            this.container = window.L.DomUtil.createWithId('div', `${this.type}-container`, $(`#${this.type}-panel`).get(0));
        }
        this.wrapper = document.getElementById(`${this.type}-dock-wrapper`);
        this.documentContainer = document.querySelector('#document-container');
    }
    onAdd(map) {
        this.map = map;
        this.createBuilder();
        this.setupContainer(undefined);
        app.events.on('resize', this.onResize.bind(this));
        this.registerMessageHandlers();
    }
    onRemove() {
        this.unregisterMessageHandlers();
    }
    /// this is used to determine if we need to send uno command - only for core decks
    isVisible() {
        const node = $(this.wrapper);
        return node.hasClass('visible') && node.hasClass('coreBased');
    }
    /// checks if this sidebar is core-based (uses WindowId.Sidebar)
    isCoreBased() {
        return this.builder && this.builder.windowId === WindowId.Sidebar;
    }
    /// shared implementation for showing/hiding sidebar
    showSidebarImpl(show) {
        const wrapper = $(this.wrapper);
        if (show) {
            wrapper.addClass('visible');
            if (this.isCoreBased()) {
                wrapper.addClass('coreBased');
            }
        }
        else {
            wrapper.removeClass('visible');
            wrapper.removeClass('coreBased');
            if (!this.map.editorHasFocus()) {
                this.map.fire('editorgotfocus');
                this.map.focus();
            }
        }
        const upperCaseType = this.type[0].toUpperCase() + this.type.slice(1);
        this.map.uiManager.setDocTypePref('Show' + upperCaseType, show);
        // Several components share one dock, and only the one that opened or closed it knows
        // that the content changed hands. The word goes out from here, the single place a dock
        // is shown and hidden, so a component that shares a dock is told rather than asking.
        this.map.fire('dockcontent', {
            wrapper: this.wrapper,
            jsontype: show ? this.allowedJsonType : null,
        });
    }
    closeSidebar() {
        this.showSidebarImpl(false);
    }
    showSidebar() {
        this.showSidebarImpl(true);
    }
    onJSUpdate(e) {
        // reduce unwanted warnings in console
        if (e?.data?.control.id === 'addonimage') {
            window.app.console.log('Ignored update for control: ' + e.data.control.id);
            return false;
        }
        return super.onJSUpdate(e);
    }
    onJSAction(e) {
        const innerData = e?.data?.data;
        const controlId = innerData?.control_id;
        if (controlId) {
            // Panels share the same name for main containers, do not execute actions for them
            // if panel has to be shown or hidden, full update will appear
            if (controlId.indexOf('contents') === 0 ||
                controlId.indexOf('titlebar') === 0 ||
                controlId.indexOf('expander') === 0 ||
                controlId.indexOf('addonimage') === 0) {
                window.app.console.log('Ignored action: ' +
                    innerData.action_type +
                    ' for control: ' +
                    controlId);
                return false;
            }
        }
        return super.onJSAction(e);
    }
    /// The presentation sidebar/panel toolbar buttons are mutually exclusive, so
    /// only the button of the active deck stays highlighted. Core reports the
    /// state of its own decks, but the decks the browser builds itself are opened
    /// from the notebookbar and core is never told they took over the sidebar.
    /// Their highlight, and clearing the core deck button they replace, is
    /// driven here.
    updatePresentationDeckHighlight(currentDeck) {
        if (this.map.getDocType() !== 'presentation')
            return;
        const panelCommandForDeck = {
            'transitions-deck': 'transitiondeck',
            'animations-deck': 'animationdeck',
            'cleanup-deck': 'cleanupdeck',
        };
        const coreDeckCommands = [
            '.uno:SidebarDeck.PropertyDeck',
            '.uno:ModifyPage',
            '.uno:CustomAnimation',
            '.uno:MasterSlidesPanel',
        ];
        const activePanelCommand = panelCommandForDeck[currentDeck];
        const stateHandler = this.map['stateChangeHandler'];
        const setHighlight = (command, active) => {
            const value = active ? 'true' : 'false';
            if (stateHandler && stateHandler.getItemValue(command) === value)
                return;
            this.map.fire('commandstatechanged', {
                commandName: command,
                state: value,
            });
        };
        Object.values(panelCommandForDeck).forEach((command) => setHighlight(command, command === activePanelCommand));
        // A notebookbar panel has taken over the sidebar: core still thinks its
        // last deck is open and keeps reporting it active, so clear those buttons.
        if (activePanelCommand)
            coreDeckCommands.forEach((command) => setHighlight(command, false));
    }
    markNavigatorTreeView(data) {
        if (!data)
            return false;
        if (data.type === 'treelistbox') {
            data.draggable = false;
            return true;
        }
        for (const i in data.children) {
            if (this.markNavigatorTreeView(data.children[i])) {
                return true;
            }
        }
        return false;
    }
    onResize() {
        if (this.resizeTaskId)
            app.layoutingService.cancelLayoutingTask(this.resizeTaskId);
        this.resizeTaskId = app.layoutingService.appendLayoutingTask(() => {
            if (this.container) {
                this.container.style.height =
                    this.wrapper.getBoundingClientRect().height + 'px';
            }
            this.resizeTaskId = null;
        });
    }
    callback(objectType, eventType, object, data, builder) {
        return builder._defaultCallbackHandler(objectType, eventType, object, data, builder);
    }
}
JSDialog.SidebarBase = SidebarBase;

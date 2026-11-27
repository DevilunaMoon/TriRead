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
const NOTES_PANEL_MIN_HEIGHT = 60;
const NOTES_PANEL_DEFAULT_HEIGHT = 76;
class NotesPanel extends JSDialogComponent {
    constructor(map) {
        super(map, 'notespanel', 'notespanel');
        this.wrapper = null;
        this.column = null;
        this.splitter = null;
        this.dragStartY = 0;
        this.dragStartHeight = 0;
        /// Leave the notes while the view is still editable, so the engine saves the typing.
        this.onUpdatePermission = (e) => {
            if (e.detail.perm !== 'readonly' || !this.container)
                return;
            const focused = document.activeElement;
            if (!(focused instanceof HTMLElement) || !this.container.contains(focused))
                return;
            focused.blur();
            this.map.focus();
        };
        this.onAdd(map);
    }
    createBuilder() {
        this.builder = new window.L.control.jsDialogBuilder({
            mobileWizard: this,
            map: this.map,
            windowId: WindowId.NotesPanel,
            cssClass: 'jsdialog notespanel',
            useScrollAnimation: false,
            suffix: 'notespanel',
        });
    }
    setupContainer() {
        this.container =
            document.getElementById('notespanel-container') ?? undefined;
        this.wrapper = document.getElementById('notespanel-dock-wrapper');
        this.column = document.getElementById('document-and-notes');
        this.splitter = document.getElementById('notespanel-splitter');
        if (this.splitter)
            this.splitter.addEventListener('pointerdown', this.onSplitterDown.bind(this));
    }
    onAdd(map) {
        this.map = map;
        this.createBuilder();
        this.setupContainer();
        this.map.on('notespanel', this.onNotesPanel, this);
        app.events.on('updatepermission', this.onUpdatePermission);
        this.registerMessageHandlers();
        this.applyStoredHeight();
        this.refreshState();
    }
    onRemove() {
        this.map.off('notespanel', this.onNotesPanel, this);
        app.events.off('updatepermission', this.onUpdatePermission);
        this.unregisterMessageHandlers();
    }
    /// The engine sends the whole tree when the notes view shell appears, and single widget
    /// updates after that. Arrival of the tree is what opens the pane.
    onNotesPanel(e) {
        if (!this.container || !this.builder)
            return;
        this.container.replaceChildren();
        this.builder.build(this.container, [e.data], false);
        this.setVisible(true);
    }
    isVisible() {
        return !!this.wrapper && this.wrapper.classList.contains('visible');
    }
    /// Shows or hides the pane. The engine side follows from .uno:BottomPaneImpress, which the
    /// caller sends; this only moves the client layout.
    setVisible(show) {
        if (!this.wrapper)
            return;
        this.wrapper.classList.toggle('visible', show);
        if (this.column)
            this.column.classList.toggle('notes-visible', show);
        if (!show && this.container)
            this.container.replaceChildren();
        this.map?.uiManager.setDocTypePref('ShowNotesPanel', show);
        app.events.fire('resize', null);
        this.refreshState();
    }
    /// Broadcasts which of the three notes views is active, so the View Notes menu can mark the
    /// current entry and the status bar Notes button can show its pressed state. Exactly one of
    /// bottom panel, handout page and hidden is active at a time.
    refreshState() {
        if (!this.map)
            return;
        const bottom = this.isVisible();
        const handout = !!(app.impress && app.impress.notesMode);
        this.map.fire('commandstatechanged', {
            commandName: 'notespanel',
            state: bottom ? 'true' : 'false',
        });
        this.map.fire('commandstatechanged', {
            commandName: 'notespanelbottom',
            state: bottom ? 'true' : 'false',
        });
        this.map.fire('commandstatechanged', {
            commandName: 'notespanelhandout',
            state: handout ? 'true' : 'false',
        });
        this.map.fire('commandstatechanged', {
            commandName: 'notespanelhidden',
            state: !bottom && !handout ? 'true' : 'false',
        });
    }
    /// Opens the pane empty at its stored height, so the layout has its final size before the
    /// engine sends the content. The command state and the stored preference stay as they are.
    reserveSpace() {
        if (!this.wrapper)
            return;
        this.wrapper.classList.add('visible');
        if (this.column)
            this.column.classList.add('notes-visible');
    }
    /// Asks the engine to open or close the notes pane.
    setOpen(open) {
        this.map.sendUnoCommand('.uno:BottomPaneImpress?BottomPaneImpress:bool=' + open);
        if (!open && this.isVisible())
            this.setVisible(false);
    }
    heightPrefKey() {
        return this.map.getDocType() + '.NotesPanelHeight';
    }
    applyStoredHeight() {
        if (!this.wrapper)
            return;
        const stored = window.prefs.get(this.heightPrefKey(), NOTES_PANEL_DEFAULT_HEIGHT);
        const height = parseInt(stored, 10);
        this.wrapper.style.height =
            (isNaN(height) ? NOTES_PANEL_DEFAULT_HEIGHT : height) + 'px';
    }
    onSplitterDown(event) {
        if (!this.wrapper || !this.splitter)
            return;
        event.preventDefault();
        this.dragStartY = event.clientY;
        this.dragStartHeight = this.wrapper.getBoundingClientRect().height;
        this.splitter.setPointerCapture(event.pointerId);
        const onMove = (moveEvent) => this.onSplitterMove(moveEvent);
        const onUp = (upEvent) => {
            this.splitter?.releasePointerCapture(upEvent.pointerId);
            this.splitter?.removeEventListener('pointermove', onMove);
            this.splitter?.removeEventListener('pointerup', onUp);
            this.storeHeight();
        };
        this.splitter.addEventListener('pointermove', onMove);
        this.splitter.addEventListener('pointerup', onUp);
    }
    onSplitterMove(event) {
        if (!this.wrapper || !this.column)
            return;
        // Dragging up grows the pane, so the delta is subtracted.
        const available = this.column.getBoundingClientRect().height;
        const wanted = this.dragStartHeight - (event.clientY - this.dragStartY);
        const height = Math.max(NOTES_PANEL_MIN_HEIGHT, Math.min(wanted, available * 0.7));
        this.wrapper.style.height = height + 'px';
        app.events.fire('resize', null);
    }
    storeHeight() {
        if (!this.wrapper)
            return;
        window.prefs.set(this.heightPrefKey(), Math.round(this.wrapper.getBoundingClientRect().height));
    }
}
JSDialog.NotesPanel = function (map) {
    return new NotesPanel(map);
};

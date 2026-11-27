// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
class PaneExpander {
    // The panels the maximized layout can hold, by element id. A panel is
    // open while it carries the visible class.
    static { this.PANEL_IDS = [
        'navigation-sidebar',
        'slide-import-dock-wrapper',
    ]; }
    constructor(map) {
        this.mode = 'normal';
        this.map = map;
        this.mainContent = document.getElementById('main-document-content');
        document.addEventListener('keydown', this.onKeyDown.bind(this), true);
        this.map.on('themechanged', this.updateToggles, this);
        // A document loads in the normal side-by-side layout. When one is
        // opened in place of another the maximized state would otherwise
        // carry over, so clear it as the new document's layer comes up.
        this.map.on('doclayerinit', this.reset, this);
    }
    getMode() {
        return this.mode;
    }
    toggle() {
        this.setMode(this.mode === 'expanded' ? 'normal' : 'expanded');
    }
    reset() {
        this.setMode('normal');
    }
    // A panel is closing. The maximized layout survives while another panel
    // stays open (its grid takes the whole area); once the last one goes the
    // layout has nowhere to live, so it returns to normal.
    onPanelClosing(closingPanelId) {
        if (this.mode !== 'expanded')
            return;
        for (const id of PaneExpander.PANEL_IDS) {
            if (id === closingPanelId)
                continue;
            const panel = document.getElementById(id);
            if (panel && panel.classList.contains('visible'))
                return;
        }
        this.reset();
    }
    setMode(mode) {
        if (this.mode === mode || !this.mainContent)
            return;
        this.mainContent.classList.toggle('panes-expanded', mode === 'expanded');
        this.mode = mode;
        // The slide list is a grid only while the panels fill the document
        // area; otherwise it stays the narrow vertical strip.
        this.applyGridMode(mode === 'expanded');
        this.updateToggles();
        if (this.map.paneSplitter)
            this.map.paneSplitter.onModeChange();
        if (this.map.navigator)
            this.map.navigator.updateFloatingButtonVisibility();
    }
    applyGridMode(enabled) {
        const preview = this.map._docLayer && this.map._docLayer._preview;
        if (preview && typeof preview.setGridMode === 'function')
            preview.setGridMode(enabled);
        if (this.map.slideImportPane)
            this.map.slideImportPane.setGridMode(enabled);
    }
    // Every panel's expand toggle carries the shared class, so one query
    // keeps them all reflecting the one shared mode.
    updateToggles() {
        const expanded = this.mode === 'expanded';
        document.querySelectorAll('.navigation-expand-button').forEach((button) => {
            PaneExpander.setToggleState(button, expanded);
        });
    }
    // The toggle keeps one accessible name, and aria-pressed tells whether the panels are
    // maximized. The tooltip and the icon name the action that a press performs from the given
    // state.
    static setToggleState(button, expanded) {
        button.setAttribute('aria-label', _('Maximize to grid'));
        button.setAttribute('aria-pressed', expanded ? 'true' : 'false');
        button.setAttribute('data-cooltip', expanded ? _('Exit grid') : _('Maximize to grid'));
        const img = button.querySelector('img');
        if (!img)
            return;
        const name = expanded ? 'collapse-slides.svg' : 'expand-slides.svg';
        img.src = app.LOUtil.getImageURL(name);
    }
    // Escape returns to the normal layout before any panel handles it as a
    // request to close itself, so the first press only un-maximizes. An open
    // menu, dropdown or dialog gets the first press instead, so a transient
    // popup still closes on Escape while a panel is maximized.
    onKeyDown(e) {
        if (e.key !== 'Escape' || this.mode === 'normal')
            return;
        if (this.isTransientPopupOpen())
            return;
        this.reset();
        // A tooltip on screen shows the text it read when it opened, which named the action of
        // the layout just left, so it closes with that layout.
        if (this.map.tooltip)
            this.map.tooltip.hide();
        e.preventDefault();
        e.stopPropagation();
    }
    isTransientPopupOpen() {
        const ui = this.map.uiManager;
        if (ui && ui.isAnyContextMenuOpened && ui.isAnyContextMenuOpened())
            return true;
        if (this.map.jsdialog &&
            this.map.jsdialog.hasDialogOpened &&
            this.map.jsdialog.hasDialogOpened())
            return true;
        if (this.map.dialog &&
            this.map.dialog.hasOpenedDialog &&
            this.map.dialog.hasOpenedDialog())
            return true;
        return false;
    }
}

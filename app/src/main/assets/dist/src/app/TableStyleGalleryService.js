/* -*- js-indent-level: 8; fill-column: 100 -*- */
class TableStyleGalleryService {
    constructor() {
        // The styles alone, in list order; the row index of a gallery entry indexes this array.
        this.styles = [];
        // The list as the engine sent it: the styles with the section titles between them.
        this.listItems = [];
        this.currentStyleName = '';
        app.map.on('commandstatechanged', this.onCommandState.bind(this));
    }
    // Writer applies a style with .uno:SetTableStyle rather than .uno:TableStyle: it already has
    // an unrelated, older command named "TableStyle" (the table-styles family in the Manage
    // Styles sidebar), and UNO command lookup resolves by name against whichever slot registered
    // first, so reusing that name would silently dispatch to the wrong command. The document
    // type is known only once the document has loaded, so it is looked up on every call.
    getApplyCommand() {
        return app.map.getDocType() === 'text'
            ? '.uno:SetTableStyle'
            : '.uno:TableStyle';
    }
    onCommandState(e) {
        if (e.commandName === this.getApplyCommand()) {
            if (typeof e.state !== 'string')
                return;
            this.currentStyleName = e.state;
            this.updateTableStylesGallery();
            return;
        }
        if (e.commandName !== '.uno:TableStyleList')
            return;
        if (!e.state)
            return;
        try {
            const parsed = typeof e.state === 'string' ? JSON.parse(e.state) : e.state;
            this.listItems = parsed.TableStyles || [];
            this.styles = this.listItems.filter((item) => !('Separator' in item));
        }
        catch (ex) {
            app.console.error('Failed to parse TableStyleList: ' + ex);
            return;
        }
        this.updateTableStylesGallery();
    }
    updateTableStylesGallery() {
        app.map.fire('jsdialogupdate', {
            data: {
                id: WindowId.Notebookbar + '',
                type: '',
                jsontype: 'notebookbar',
                action: 'update',
                control: this.generateTableStylesJSON(),
            },
        });
    }
    generateTableStylesJSON() {
        return {
            id: 'table-design-styles',
            type: 'iconview',
            text: _('Table Styles'),
            aria: { label: _('Table Styles') },
            accessibility: { focusBack: true, combination: 'TL' },
            entries: this.generateEntries(),
            singleclickactivate: true,
            textWithIconEnabled: !this.styles.some((style) => style.Image),
            selectionmode: 'single',
        };
    }
    // A section title becomes a separator entry without a row. A style's row is its index in
    // the styles array, which is what the selection callback reports back.
    generateEntries() {
        let row = 0;
        // A used style is listed twice, first among the styles the document uses and again in
        // its catalog section, and only the first entry shows as selected.
        let selectedFound = false;
        return this.listItems.map((item) => {
            if ('Separator' in item) {
                return { separator: true, text: item.Title };
            }
            const isSelected = !selectedFound && item.Name === this.currentStyleName;
            if (isSelected)
                selectedFound = true;
            return {
                row: row++,
                text: item.DisplayName || item.Name,
                // The engine falls back to an empty string per-style if
                // rendering that one style's preview failed - don't let
                // that show as a broken image.
                image: item.Image || 'images/lc_table_none.svg',
                width: 56,
                height: 31,
                selected: isSelected,
            };
        });
    }
    applyStyle(stylePos) {
        const style = this.styles[stylePos];
        if (!style)
            return;
        // The engine's slot names the command's string parameter after the command itself.
        const applyCommand = this.getApplyCommand();
        const argument = applyCommand.substring('.uno:'.length);
        app.map.sendUnoCommand(applyCommand, {
            [argument]: { type: 'string', value: style.Name },
        });
    }
}

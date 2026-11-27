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
// Non-UNO IDs that share a shortcut with a UNO (or findbar protocol)
// command.  Routing them through the locale-aware shortcut table keeps
// tooltips in sync with what the user actually has to press.
const UNO_ALIASES = {
    save: '.uno:Save',
    print: '.uno:Print',
    insertcomment: '.uno:InsertAnnotation',
    hyperlinkdialog: '.uno:HyperlinkDialog',
    inserthyperlink: '.uno:HyperlinkDialog',
    search: 'vnd.sun.star.findbar:FocusToFindbar',
    'home-search': 'vnd.sun.star.findbar:FocusToFindbar',
};
// Non-UNO IDs with explicit shortcuts not from Accelerators.xcu.
const EXPLICIT_ALIASES = {
    'keyboard-shortcuts': 'Ctrl+Shift+?',
    // The browser always binds Ctrl+F to open the find bar globally,
    // regardless of locale (locale-specific additional bindings are extra).
    // Do not use vnd.sun.star.findbar:FocusToFindbar here: its XCU entry
    // reflects the desktop shortcut, which differs from the browser binding
    // in some locales (e.g. German desktop uses Shift+Alt+F).
    find: 'Ctrl+F',
    switchtoedit: 'Ctrl+Shift+E',
};
class ShortcutsUtil {
    constructor() {
        // One map per document type, built the first time that type asks.
        this.shortcutMaps = new Map();
    }
    /** The document type the shortcuts are being asked about. */
    docType() {
        const map = window.app ? window.app.map : null;
        return map && map._docLayer ? map._docLayer._docType : '';
    }
    buildMap(docType) {
        const shortcutMap = new Map();
        // Shortcuts generated from core's Accelerators.xcu: what every
        // document type shares, then what this one says instead, then
        // what this UI language says instead of that.  An empty string
        // means the command has no shortcut here.
        const layers = [];
        if (typeof unoShortcutsMap !== 'undefined') {
            layers.push(unoShortcutsMap);
        }
        if (typeof unoShortcutsDocType !== 'undefined') {
            layers.push(unoShortcutsDocType[docType] || {});
        }
        if (typeof unoShortcutsL10N !== 'undefined') {
            const overrides = Util.getLanguageEntry(unoShortcutsL10N);
            if (overrides) {
                layers.push(overrides[docType] || {});
            }
        }
        for (const layer of layers) {
            for (const [command, shortcut] of Object.entries(layer)) {
                shortcutMap.set(command, shortcut);
            }
        }
        // Aliases: non-UNO IDs that resolve to a UNO command's shortcut.
        for (const [alias, unoCmd] of Object.entries(UNO_ALIASES)) {
            const shortcut = shortcutMap.get(unoCmd);
            if (shortcut) {
                shortcutMap.set(alias, shortcut);
            }
        }
        // Explicit aliases not derived from the XCU.
        for (const [alias, shortcut] of Object.entries(EXPLICIT_ALIASES)) {
            shortcutMap.set(alias, shortcut);
        }
        return shortcutMap;
    }
    map() {
        const docType = this.docType();
        let shortcutMap = this.shortcutMaps.get(docType);
        if (!shortcutMap) {
            shortcutMap = this.buildMap(docType);
            this.shortcutMaps.set(docType, shortcutMap);
        }
        return shortcutMap;
    }
    hasShortcut(command) {
        return !!this.map().get(command);
    }
    /**
     * Returns the text with appended shortcut for a given text and UNO Command.
     * @param {string} text - The text to localize.
     * @param {string} shortcut - The shortcut to localize.
     * @returns {string} - The localized text with the shortcut.
     */
    localizeModifiers(text) {
        if (typeof unoShortcutsModifierL10N !== 'undefined') {
            const replacements = Util.getLanguageEntry(unoShortcutsModifierL10N);
            if (replacements) {
                for (const [eng, loc] of Object.entries(replacements)) {
                    text = text.replace(eng, loc);
                }
            }
        }
        return text;
    }
    getTooltipLabel(text, command) {
        const shortcut = this.getShortcutText(command);
        if (!shortcut)
            return text;
        return _(text).replace('~', '') + ' (' + shortcut + ')';
    }
    getMenuLabel(text, command) {
        const shortcut = this.getShortcutText(command);
        if (!shortcut)
            return text;
        return (_(text).replace('~', '') +
            ' <span class="shortcut">' +
            shortcut +
            '</span>');
    }
    /**
     * Return the locale-aware shortcut display string for a UNO command,
     * or undefined if none is registered. On Mac, "Ctrl"/"Alt" are replaced
     * with the corresponding Mac symbols.
     */
    getShortcutText(command) {
        const shortcut = this.map().get(command);
        if (!shortcut)
            return undefined;
        return app.util.replaceCtrlAltInMac(this.localizeModifiers(shortcut));
    }
}
JSDialog.ShortcutsUtil = new ShortcutsUtil();

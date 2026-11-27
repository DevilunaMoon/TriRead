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
function isCtrlKey(e) {
    if (window.ThisIsTheiOSApp || window.L.Browser.mac)
        return e.metaKey;
    else
        return e.ctrlKey;
}
function isMacCtrlKey(e) {
    if (window.ThisIsTheiOSApp || window.L.Browser.mac)
        return e.ctrlKey;
    else
        return false;
}
var Mod;
(function (Mod) {
    Mod[Mod["NONE"] = 0] = "NONE";
    Mod[Mod["CTRL"] = 1] = "CTRL";
    Mod[Mod["ALT"] = 2] = "ALT";
    Mod[Mod["SHIFT"] = 4] = "SHIFT";
    Mod[Mod["MACCTRL"] = 8] = "MACCTRL";
})(Mod || (Mod = {}));
var ViewType;
(function (ViewType) {
    ViewType[ViewType["Edit"] = 0] = "Edit";
    ViewType[ViewType["ReadOnly"] = 1] = "ReadOnly";
})(ViewType || (ViewType = {}));
var Platform;
(function (Platform) {
    Platform[Platform["ANDROIDAPP"] = 1] = "ANDROIDAPP";
    Platform[Platform["IOSAPP"] = 2] = "IOSAPP";
    Platform[Platform["MAC"] = 4] = "MAC";
    Platform[Platform["WINDOWS"] = 8] = "WINDOWS";
    Platform[Platform["LINUX"] = 16] = "LINUX";
    Platform[Platform["CHROMEOSAPP"] = 32] = "CHROMEOSAPP";
    Platform[Platform["CODAWINDOWS"] = 64] = "CODAWINDOWS";
    Platform[Platform["CODAMAC"] = 128] = "CODAMAC";
    Platform[Platform["CODAQT"] = 256] = "CODAQT";
})(Platform || (Platform = {}));
class ShortcutDescriptor {
    constructor({ docType = null, eventType, modifier = Mod.NONE, keyCode = null, key = null, unoAction = null, dispatchAction = null, dispatchData = null, viewType = null, preventDefault = true, platform = null, showViewModeAttention = true, condition = null, }) {
        app.console.assert(keyCode !== null || key !== null, 'registering a keyboard shortcut without specifying either a key or a keyCode - this will result in an untriggerable shortcut');
        // Layout independence: a single letter or digit key always has a
        // fixed keyCode (the US-layout ASCII value), even though event.key
        // changes by layout (physical F is event.key === 'а' on Russian).
        // Auto-deriving keyCode from key here means a binding with just
        // key:'f' still fires on the physical F key everywhere.
        if (keyCode === null && key !== null && key.length === 1) {
            const code = key.charCodeAt(0);
            if (code >= 0x41 && code <= 0x5A)
                keyCode = code; // A-Z
            else if (code >= 0x61 && code <= 0x7A)
                keyCode = code - 0x20; // a-z
            else if (code >= 0x30 && code <= 0x39)
                keyCode = code; // 0-9
        }
        this.docType = docType;
        this.eventType = eventType;
        this.modifier = modifier;
        this.keyCode = keyCode;
        this.key = key;
        this.unoAction = unoAction;
        this.dispatchAction = dispatchAction;
        this.dispatchData = dispatchData;
        this.viewType = viewType;
        this.preventDefault = preventDefault;
        this.platform = platform;
        this.showViewModeAttention = showViewModeAttention;
        this.condition = condition;
    }
}
// The engine writes a shortcut as its modifiers and key name joined by '+', as in 'Ctrl+Shift+B',
// 'Ctrl+Shift++' or 'Shift+Return'. Returns the modifier and the key as KeyboardEvent.key names it.
function parseEngineShortcut(text) {
    const engineKeyNames = {
        Return: 'Enter', Space: ' ', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft',
        Right: 'ArrowRight', Esc: 'Escape', Del: 'Delete', Ins: 'Insert',
    };
    const parts = text.endsWith('++') ? text.slice(0, -2).split('+').concat(['+']) : text.split('+');
    const name = parts.pop();
    if (!name)
        return null;
    let modifier = Mod.NONE;
    for (const part of parts) {
        if (part === 'Ctrl')
            modifier |= Mod.CTRL;
        else if (part === 'Alt')
            modifier |= Mod.ALT;
        else if (part === 'Shift')
            modifier |= Mod.SHIFT;
        else
            return null;
    }
    return { modifier: modifier, key: engineKeyNames[name] || name };
}
class KeyboardShortcuts {
    constructor() {
        this.definitions = new Map();
    }
    findShortcut(language, eventType, modifier, keyCode, key, platform) {
        const descriptors = this.definitions.get(language);
        if (!descriptors) {
            return undefined;
        }
        const docType = this.map._docLayer ? this.map._docLayer._docType : '';
        const viewType = this.map.isEditMode() ? ViewType.Edit : ViewType.ReadOnly;
        const shortcuts = descriptors.filter((descriptor) => {
            const keyMatches = descriptor.key === key;
            const keyCodeMatches = Array.isArray(descriptor.keyCode) ? descriptor.keyCode.includes(keyCode) : descriptor.keyCode === keyCode;
            return (!descriptor.docType || descriptor.docType === docType) &&
                (Array.isArray(descriptor.eventType) ? descriptor.eventType.includes(eventType) : descriptor.eventType === eventType) &&
                descriptor.modifier === modifier &&
                (descriptor.viewType === null || descriptor.viewType === viewType) &&
                (!descriptor.platform || (descriptor.platform & platform)) &&
                (keyMatches || keyCodeMatches) &&
                (!descriptor.condition || descriptor.condition());
        });
        if (shortcuts.length > 1) {
            throw 'Multiple definitions of the same keyboard shortcut';
        }
        if (shortcuts.length) {
            return shortcuts[0];
        }
        return undefined;
    }
    /// returns true if handled action
    processEventImpl(language, event) {
        const eventType = event.type;
        const ctrl = isCtrlKey(event);
        const shift = event.shiftKey;
        const alt = event.altKey;
        const keyCode = event.which;
        const key = event.key;
        const macctrl = isMacCtrlKey(event);
        const modifier = (ctrl ? Mod.CTRL : Mod.NONE) |
            (shift ? Mod.SHIFT : Mod.NONE) |
            (alt ? Mod.ALT : Mod.NONE) |
            (macctrl ? Mod.MACCTRL : Mod.NONE);
        const shortcut = this.findShortcut(language, eventType, modifier, keyCode, key, this.currentPlatform());
        if (shortcut) {
            // In read-only mode, block shortcuts that send uno commands to core, or
            // that run an extension's own command (an opaque script we cannot
            // otherwise tell apart from one that edits the document), unless they
            // are explicitly meant for read-only use.  (Extensions are hidden entirely by
            // Control.Extension.ts's loadExtensions when a doc opens in a restricted mode, so the
            // ext: branch here only fires for a doc that was editable at open and has since been
            // toggled into view mode.)
            const isExtensionAction = !!shortcut.dispatchAction && shortcut.dispatchAction.startsWith('ext:');
            if (!this.map.isEditMode() && (shortcut.unoAction || isExtensionAction) &&
                shortcut.showViewModeAttention &&
                shortcut.viewType !== ViewType.ReadOnly) {
                event.preventDefault();
                this.map.uiManager.showViewModeAttention();
                return true;
            }
            let action = 'disabled';
            if (shortcut.unoAction) {
                action = shortcut.unoAction;
                this.map.sendUnoCommand(action);
            }
            else if (shortcut.dispatchAction) {
                action = shortcut.dispatchAction;
                app.dispatcher.dispatch(action, shortcut.dispatchData);
            }
            if (shortcut.preventDefault) {
                event.preventDefault();
            }
            console.debug('handled keyboard shortcut: ' + action);
            return true;
        }
        return false;
    }
    currentPlatform() {
        return window.mode.isChromebook() ? Platform.CHROMEOSAPP :
            window.ThisIsTheAndroidApp ? Platform.ANDROIDAPP : // Cannot come before window.mode.isChromebook() as all Chromebook app users are necessarily also Android app users
                window.ThisIsTheiOSApp ? Platform.IOSAPP :
                    window.ThisIsTheWindowsApp ? Platform.CODAWINDOWS :
                        window.ThisIsTheMacOSApp ? Platform.CODAMAC :
                            window.ThisIsTheQtApp ? Platform.CODAQT :
                                window.L.Browser.mac ? Platform.MAC :
                                    window.L.Browser.win ? Platform.WINDOWS :
                                        Platform.LINUX;
    }
    // has to be called before use
    initialize(map) {
        this.map = map;
        // in cypress it can fail on load to not allow for duplicated shortcuts
        if (window.L.Browser.cypressTest) {
            this.map.on('docloaded', () => { keyboardShortcuts.verifyShortcuts(); });
        }
    }
    processEvent(language, event) {
        if (!this.map) {
            throw 'KeyboardShortcuts not initialized';
        }
        // The language comes from the URL, so it can carry a region -
        // 'de-DE' rather than 'de'.  Only a few of those have a table of
        // their own ('pt-BR'); the rest use their base language's, the way
        // the shortcut tooltips already do.
        const dash = language.indexOf('-');
        if (dash !== -1 && !this.definitions.has(language)) {
            language = language.substring(0, dash);
        }
        if (this.processEventImpl(language, event)) {
            return true;
        }
        return this.processEventImpl('default', event);
    }
    // True if a shortcut the editor already has would match a keydown with this exact modifier and
    // key, for this document's own docType or for every docType, on this platform. That covers the
    // descriptors of the 'default' list and of the user's own language, which is tried first, and
    // the shortcuts of the engine's commands. Each keypress may match one descriptor at most, and a
    // descriptor that matches a keypress keeps it from reaching the engine.
    collidesWithExisting(docType, modifier, key) {
        const candidate = new ShortcutDescriptor({ eventType: 'keydown', modifier: modifier, key: key });
        const platform = this.currentPlatform();
        const sameKey = (d) => {
            const keyCodes = Array.isArray(d.keyCode) ? d.keyCode : [d.keyCode];
            return (d.key !== null && d.key.toLowerCase() === key.toLowerCase()) ||
                (candidate.keyCode !== null && keyCodes.indexOf(candidate.keyCode) !== -1);
        };
        const language = app.UI && app.UI.language ? app.UI.language.fromURL : undefined;
        const descriptors = (this.definitions.get('default') || []).concat(language && language !== 'default' ? this.definitions.get(language) || [] : []);
        const inEditor = descriptors.some((d) => {
            const eventTypes = Array.isArray(d.eventType) ? d.eventType : [d.eventType];
            return eventTypes.indexOf('keydown') !== -1 &&
                d.modifier === modifier &&
                sameKey(d) &&
                (!d.docType || d.docType === docType) &&
                (!d.platform || (d.platform & platform) !== 0);
        });
        if (inEditor)
            return true;
        if (typeof unoShortcutsMap === 'undefined')
            return false;
        return Object.keys(unoShortcutsMap).some((command) => {
            const engine = parseEngineShortcut(unoShortcutsMap[command]);
            return engine !== null && engine.modifier === modifier &&
                engine.key.toLowerCase() === key.toLowerCase();
        });
    }
    // Registers each loaded extension's contributes.keybindings entries as
    // dispatchAction-based shortcuts in the 'default' language list. Called once,
    // after extension discovery resolves (see ServerConnectionService's
    // onDocumentLoaded) - there is no later point that needs to call this again,
    // since the extension list itself is only ever populated once per document.
    applyExtensionKeybindings() {
        if (!window.enableExperimentalFeatures)
            return;
        const exts = (this.map && this.map._extensions) || {};
        const docType = this.map && this.map._docLayer ? this.map._docLayer._docType : '';
        const defaultShortcuts = this.definitions.get('default');
        Object.keys(exts).sort().forEach((extId) => {
            const manifest = exts[extId].options.manifest;
            const contributed = manifest.contributes && manifest.contributes.keybindings;
            if (!contributed || !contributed.length)
                return;
            const commands = manifest.contributes.commands || [];
            contributed.forEach((entry) => {
                const command = commands.filter((c) => c.id === entry.command)[0];
                if (!command) {
                    console.warn('extension ' + extId + ': keybinding references unknown command "' + entry.command + '"');
                    return;
                }
                const modifierNames = entry.modifier || [];
                let modifier = Mod.NONE;
                if (modifierNames.indexOf('ctrl') !== -1)
                    modifier |= Mod.CTRL;
                if (modifierNames.indexOf('alt') !== -1)
                    modifier |= Mod.ALT;
                if (modifierNames.indexOf('shift') !== -1)
                    modifier |= Mod.SHIFT;
                // Any key without ctrl or alt belongs to the document: a letter is typed, and Enter,
                // Tab, Delete or an F key already has a meaning there.
                const key = entry.key;
                if (!(modifier & (Mod.CTRL | Mod.ALT))) {
                    console.warn('extension ' + extId + ': keybinding for "' + entry.command +
                        '" ("' + key + '") needs ctrl or alt, not shift alone or no modifier');
                    return;
                }
                if (this.collidesWithExisting(docType, modifier, key)) {
                    console.warn('extension ' + extId + ': keybinding for "' + entry.command +
                        '" ("' + key + '") collides with an existing shortcut and was not registered');
                    return;
                }
                defaultShortcuts.push(new ShortcutDescriptor({
                    eventType: 'keydown',
                    modifier: modifier,
                    key: key,
                    dispatchAction: 'ext:' + extId + ':' + entry.command,
                }));
            });
        });
    }
    verifyShortcuts() {
        console.debug('KeyboardShortcuts.verifyShortcuts start');
        this.definitions.forEach((shortcuts, language) => {
            shortcuts.forEach((shortcut) => {
                // throws an exception if finds duplicated
                const shortcutEventTypes = Array.isArray(shortcut.eventType) ? shortcut.eventType : [shortcut.eventType];
                const shortcutKeyCodes = Array.isArray(shortcut.keyCode) ? shortcut.keyCode : [shortcut.keyCode];
                for (const eventType of shortcutEventTypes) {
                    for (const keyCode of shortcutKeyCodes) {
                        if (keyCode === null) {
                            continue;
                        }
                        this.findShortcut(language, eventType, shortcut.modifier, keyCode, undefined, shortcut.platform);
                    }
                    if (shortcut.key === null) {
                        continue;
                    }
                    this.findShortcut(language, eventType, shortcut.modifier, undefined, shortcut.key, shortcut.platform);
                }
            });
        });
        console.debug('KeyboardShortcuts.verifyShortcuts finished');
    }
}
const keyboardShortcuts = new KeyboardShortcuts();
// Default shortcuts.
keyboardShortcuts.definitions.set('default', new Array(
// FIXME: Should we mark shortcuts that are supposed to work *only* in editing mode with
// viewType: ViewType.Edit? Having viewType as null means the shortcut is supposed to work in
// either viewing or editing mode, and having it as ViewType.ReadOnly means it is supposed to
// work only in viewing mode. At least if you believe the comment for viewType in the
// ShortcutDescriptor constructor.
// All document types.
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'o', platform: Platform.CODAWINDOWS | Platform.CODAMAC | Platform.CODAQT, unoAction: '.uno:Open' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'w', platform: Platform.CODAWINDOWS | Platform.CODAQT, unoAction: '.uno:CloseWin', showViewModeAttention: false }), 
// Document tabs, like the tab navigation of web browsers (Qt app only for now).
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'PageDown', platform: Platform.CODAQT, unoAction: '.uno:NextDocumentTab', showViewModeAttention: false }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'PageUp', platform: Platform.CODAQT, unoAction: '.uno:PreviousDocumentTab', showViewModeAttention: false }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'Tab', platform: Platform.CODAQT, unoAction: '.uno:RecentlyUsedDocumentTab', showViewModeAttention: false }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'E', dispatchAction: 'switchtoedit', viewType: ViewType.ReadOnly, showViewModeAttention: false }), 
/*
    Disable F5 or assign it something to prevent browser refresh.
    Disable multi-sheet selection shortcuts in Calc.
    Disable F2 in Writer, formula bar is unsupported, and messes with further input.
    Disable CTRL+SHIFT+N because core side template dialog is not supported on Online.
*/
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'b', unoAction: '.uno:Bold' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'i', unoAction: '.uno:Italic' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'u', unoAction: '.uno:Underline' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'N' }), new ShortcutDescriptor({ eventType: 'keydown', key: 'F1', dispatchAction: 'showhelp' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.ALT, key: 'F1', dispatchAction: 'focustonotebookbar' }), new ShortcutDescriptor({ eventType: 'keydown', key: 'F6', dispatchAction: 'focusnextregion', showViewModeAttention: false }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.SHIFT, key: 'F6', dispatchAction: 'focuspreviousregion', showViewModeAttention: false }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'f', dispatchAction: 'home-search' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'p', dispatchAction: 'print' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 's', dispatchAction: 'save', dispatchData: 'keyboard' }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT | Mod.ALT, key: 'V', unoAction: '.uno:PasteSpecial', platform: Platform.WINDOWS | Platform.LINUX | Platform.MAC | Platform.CHROMEOSAPP }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'V', dispatchAction: '.uno:PasteSpecial', platform: Platform.CODAQT | Platform.CODAWINDOWS | Platform.CODAMAC }), 
// Calc.
new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'PageUp', dispatchAction: 'scrollpageup', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'PageDown', dispatchAction: 'scrollpagedown', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageUp', platform: Platform.CODAQT, unoAction: '.uno:JumpToPrevTable', showViewModeAttention: false }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageDown', platform: Platform.CODAQT, unoAction: '.uno:JumpToNextTable', showViewModeAttention: false }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageUp', platform: ~Platform.CODAQT }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'PageDown', platform: ~Platform.CODAQT }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F5' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F9', unoAction: '.uno:Calculate' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL, key: ',', unoAction: '.uno:InsertCurrentDate' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.CTRL, key: ';', unoAction: '.uno:InsertCurrentDate' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F10', dispatchAction: 'sheettabmenu',
    condition: () => { const el = document.activeElement; return !!el && el.classList.contains('spreadsheet-tab'); } }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F10', dispatchAction: 'rowcolumnheadermenu',
    condition: () => {
        const el = document.activeElement;
        if (el && el.classList.contains('spreadsheet-tab'))
            return false;
        const map = app.map;
        return !!(map && (map.wholeColumnSelected || map.wholeRowSelected));
    } }), 
// Writer.
new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'PageUp', dispatchAction: 'scrollpageup', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'PageDown', dispatchAction: 'scrollpagedown', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F2' }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F3', unoAction: '.uno:ExpandGlossary' }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.CTRL, key: 'F3' }), 
// browsers fire no keypress for function keys
new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F4',
    unoAction: '.uno:GraphicDialog' }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F4',
    unoAction: '.uno:JumpToNextFrame' }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', key: 'F5' }), 
// Impress.
new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'F5', dispatchAction: 'presentation' }), new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.CTRL, key: 'a', dispatchAction: 'selectallslides',
    condition: () => app.map.keyboard._slideSorterFocused() }), new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:CopyObjects', viewType: ViewType.Edit }), 
// Draw.
new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'F5' }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageUp', dispatchAction: 'previouspart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'PageDown', dispatchAction: 'nextpart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F3', unoAction: '.uno:CopyObjects', viewType: ViewType.Edit }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'End', dispatchAction: 'lastpart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', key: 'Home', dispatchAction: 'firstpart', viewType: ViewType.ReadOnly }), new ShortcutDescriptor({ docType: 'drawing', eventType: 'keydown', modifier: Mod.CTRL, key: 'a', dispatchAction: 'selectallslides',
    condition: () => app.map.keyboard._slideSorterFocused() }), 
// Prevent F7 from triggering Caret Browsing in desktop apps.
new ShortcutDescriptor({ eventType: 'keydown', key: 'F7', unoAction: '.uno:SpellingAndGrammarDialog', platform: Platform.CODAWINDOWS | Platform.CODAMAC | Platform.CODAQT }), new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.ALT | Mod.CTRL, key: 'p', dispatchAction: 'userlist' }), 
// Passthrough some system shortcuts
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'I', preventDefault: false, platform: Platform.WINDOWS | Platform.LINUX }), // Open browser developer tools on Non-MacOS - shift means the I here is capital
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.ALT, keyCode: 73 /* keyCode('I') === 73 */, preventDefault: false, platform: Platform.MAC }), // Open browser developer tools on MacOS - registered with keyCode as alt+i triggers a dead key on MacOS
new ShortcutDescriptor({ eventType: ['keydown', 'keypress'], modifier: Mod.CTRL | Mod.MACCTRL, key: ' ', preventDefault: false, platform: Platform.MAC | Platform.IOSAPP }), // On MacOS, open system emoji picker - bound to keypress as well as keydown since as that is needed on webkit browsers (such as Safari or Orion)
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'r', preventDefault: false, platform: Platform.MAC }), // Refresh browser tab
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: 'R', preventDefault: false, platform: Platform.WINDOWS | Platform.LINUX }), // Refresh browser tab & clear cache
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'm', preventDefault: false, platform: Platform.MAC }), // On MacOS, minimize window
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'q', preventDefault: false, platform: Platform.MAC }), // On MacOS, quit browser
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'w', platform: Platform.LINUX | Platform.WINDOWS | Platform.MAC, preventDefault: false }), // Close current tab
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'n', dispatchAction: 'backstage-new', platform: Platform.CODAWINDOWS | Platform.CODAMAC | Platform.CODAQT }), // Open backstage "New" tab in desktop apps
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'n', preventDefault: false, platform: ~(Platform.CODAWINDOWS | Platform.CODAMAC | Platform.CODAQT) }), // Open new browser window (everywhere except desktop apps)
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 't', preventDefault: false }), // Open new browser tab
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: '`', preventDefault: false, platform: Platform.MAC })));
// German shortcuts: only online-specific dispatchAction entries and
// passthrough shortcuts.  A shortcut that is a UNO command belongs in
// core's Accelerators.xcu, which the kit reads in the view's own
// language.
keyboardShortcuts.definitions.set('de', new Array(new ShortcutDescriptor({ eventType: 'keydown', key: 'F12', dispatchAction: 'saveas' }), new ShortcutDescriptor({ docType: 'presentation', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F5', dispatchAction: 'presentation' }), new ShortcutDescriptor({ docType: 'text', eventType: 'keydown', modifier: Mod.ALT | Mod.CTRL, key: 's', dispatchAction: 'home-search' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', modifier: Mod.SHIFT, key: 'F2', dispatchAction: 'insertcomment' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F4', dispatchAction: 'togglerelative' }), new ShortcutDescriptor({ docType: 'spreadsheet', eventType: 'keydown', key: 'F5', dispatchAction: 'focusonaddressinput' }), 
// Passthrough some system shortcuts
new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL | Mod.SHIFT, key: '`', preventDefault: false, platform: Platform.MAC })));
// Danish shortcuts: same rule as for German
keyboardShortcuts.definitions.set('da', new Array(new ShortcutDescriptor({ eventType: 'keydown', modifier: Mod.CTRL, key: 'b', dispatchAction: 'home-search' })));
window.KeyboardShortcuts = keyboardShortcuts;

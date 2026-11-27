// @ts-strict-ignore
/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
window.L.Control.Extension = window.L.Control.extend({
    options: {
        // Identifier of the extension (its directory name under
        // browser/extensions/, used as the key in app.map._extensions and
        // as the dispatcher prefix extension-toggle-<id>).
        id: '',
        manifest: null,
        // URL prefix (with trailing slash) under which the extension's `entry`,
        // `icon`, etc. are resolved.  Already routed through LOUtil.getURL.
        baseUrl: '',
    },
    _panel: null,
    _iframe: null,
    _teardownTimer: null,
    // Correlates executescript callIds issued directly by invokeCommand (menu clicks) with
    // their completion callbacks, so _onScriptResult can tell them apart from callIds that
    // originated inside the sidebar iframe and must be relayed back there instead.
    // invokeCommand is void and returns no Promise, so these are plain callbacks, not a
    // stashed resolve/reject pair - nothing awaits them.
    _pendingCommandCalls: null,
    _nextCommandCallId: 0,
    // The google.script.run calls of GAS add-on frames that are running in the kit, keyed by
    // their executescript callId, each with the frame's window and own callId, and the call's
    // proxyId:
    _pendingGasRuns: null,
    // One modal dialog per extension at a time.  origRemove holds the un-hooked
    // L.IFrameDialog.remove so _closeDialog can dismiss without re-entering the
    // user-close override installed in _openDialog.
    // dialogId is null for an Apps Script dialog, which has no cool.dialog.open() call
    // waiting for its result.
    _dialog: null,
    onAdd: function (map) {
        this.map = map;
        this._setToolitemHighlight(false);
        this._pendingCommandCalls = {};
        this._pendingGasRuns = {};
        window.addEventListener('message', this._onPostMessage.bind(this));
        map.on('executescriptresult', this._onScriptResult, this);
        map.on('proxycall', this._onProxyCall, this);
        map.on('consolemsg', this._onConsoleMsg, this);
        map.on('comment', this._onComment, this);
    },
    _onConsoleMsg: function (e) {
        const fn = console[e.level];
        if (e.level === 'assert') {
            console.assert(false, e.message);
        }
        else if (typeof fn === 'function') {
            fn.call(console, e.message);
        }
        else {
            console.log('unkown level: ' + e.level + ', message: ' + e.message);
        }
    },
    // The extension iframe is our own content from the COOL origin.  The mobile and desktop
    // apps load over file://, where the iframe's origin is opaque and only '*' reaches it.  A
    // GAS add-on frame's origin is opaque, too, through its sandbox:
    _targetOrigin: function () {
        return window.origin.startsWith('http') &&
            !this.options.manifest.isGasExtension
            ? window.origin
            : '*';
    },
    _postToIframe: function (payload) {
        if (!this._iframe || !this._iframe.contentWindow)
            return false;
        this._iframe.contentWindow.postMessage(JSON.stringify(payload), this._targetOrigin());
        return true;
    },
    // A call or proxy ID that cool.js made in the dialog iframe starts with "dlg-", and every
    // other one comes from the sidebar iframe:
    _callerWindow: function (id) {
        const frame = String(id).startsWith('dlg-')
            ? this._dialog && this._dialog.iframeDialog._iframe
            : this._iframe;
        return (frame && frame.contentWindow) || null;
    },
    _postToWindow: function (target, payload) {
        if (!target)
            return false;
        target.postMessage(JSON.stringify(payload), this._targetOrigin());
        return true;
    },
    _postToCaller: function (id, payload) {
        return this._postToWindow(this._callerWindow(id), payload);
    },
    // Forward LOK comment events (Add/Modify/Remove) to the iframe as Extension_DocumentEvent
    // postMessages with the corresponding event name; cool.js maps each to the matching
    // cool.document.onCommentXxx handler.
    _onComment: function (e) {
        if (!this._iframe || !this._iframe.contentWindow || !e || !e.comment)
            return;
        // GAS has no such document events for an add-on's HTML to handle:
        if (this.options.manifest.isGasExtension)
            return;
        let name;
        switch (e.comment.action) {
            case 'Add':
                name = 'commentAdded';
                break;
            case 'Modify':
                name = 'commentChanged';
                break;
            case 'Remove':
                name = 'commentRemoved';
                break;
            default:
                return;
        }
        this._postToIframe({
            msgId: 'Extension_DocumentEvent',
            name: name,
            payload: e.comment,
        });
    },
    _onProxyCall: function (e) {
        if (gasProxies[e.proxyId])
            return;
        const delivered = this._postToCaller(e.proxyId, {
            msgId: 'Extension_ProxyCall',
            proxyId: e.proxyId,
            callId: e.callId,
            method: e.method,
            args: e.args,
        });
        if (!e.callId)
            return;
        // Every Extension control sees every proxy call, and a call that none of them can pass
        // to a frame, as after the dialog making it has closed, returns null to its caller in
        // the kit once all of them have seen it:
        const callId = e.callId;
        let delivery = proxyCallDeliveries.get(callId);
        if (!delivery) {
            delivery = { delivered: false };
            proxyCallDeliveries.set(callId, delivery);
            const pending = delivery;
            queueMicrotask(() => {
                proxyCallDeliveries.delete(callId);
                if (!pending.delivered) {
                    app.socket.sendMessage('proxyreturn ' + callId + ' null');
                }
            });
        }
        if (delivered)
            delivery.delivered = true;
    },
    // Dispatcher entry point for a contributed menu command (docdispatcher's
    // `ext:<id>:<commandId>` branch).  Ships the command's script straight to the
    // kit's JS-UNO context via the same executescript wire message
    // _handleSidebarMessage's Extension_Call case uses, but without needing the
    // sidebar iframe to exist: the command runs whether or not this extension's
    // panel has ever been opened.
    invokeCommand: function (commandId) {
        const commands = this.options.manifest.contributes
            ? this.options.manifest.contributes.commands
            : undefined;
        const command = commands && commands.find((c) => c.id === commandId);
        if (command && command.panel) {
            this.invokePanelCommand(commandId);
            return;
        }
        if (command && command.gasFunctionName) {
            this._invokeGasCommand(command);
            return;
        }
        if (!command || command.source === undefined) {
            console.warn('extension ' + this.options.id + ': unknown command ' + commandId);
            return;
        }
        const callId = 'cmd-' + this.options.id + '-' + this._nextCommandCallId++;
        this._pendingCommandCalls[callId] = {
            onSuccess: (value) => {
                // A result marked __coolGas carries the messages an Apps Script add-on
                // passed to getUi().alert(); the sidebar iframe shows those as a banner,
                // and a command invoked from a menu has the snackbar instead.
                const envelope = value;
                if (!envelope || envelope.__coolGas !== true)
                    return;
                for (const alert of envelope.alerts || []) {
                    if (!this.map.uiManager)
                        return;
                    this.map.uiManager.showSnackbar(alert.title ? alert.title + ': ' + alert.message : alert.message);
                }
            },
            onError: (err) => {
                console.error('extension ' +
                    this.options.id +
                    ': command ' +
                    commandId +
                    ' failed:', err);
                if (this.map.uiManager) {
                    this.map.uiManager.showSnackbar(_('Extension command failed: %1').replace('%1', err.message));
                }
            },
        };
        // Nothing clears this entry on its own if the kit never answers - document
        // teardown mid-command, a dropped socket, or the command itself hanging. Bound
        // how long it can wait, the same way _removePanel bounds the teardown handshake.
        setTimeout(() => {
            const pending = this._pendingCommandCalls[callId];
            if (!pending)
                return;
            delete this._pendingCommandCalls[callId];
            pending.onError(new Error('timed out waiting for a response'));
        }, 30000);
        // Wire format `executescript <id> <line> <source>\n<script>` (see
        // ChildSession::executeScript), matching what _handleSidebarMessage's
        // Extension_Call case sends for a cool.callRemote call: source/line let
        // a thrown exception's stack frames point back at the command's own file.
        // The script is command.source verbatim, with the call to invoke tacked on
        // after it rather than wrapped around it - nothing is prepended, so the
        // file's own line 1 column 1 stays line 1 column 1 in any reported frame.
        const source = (this.options.baseUrl + command.script).replace(/\n/g, '');
        app.socket.sendMessage('executescript ' +
            callId +
            ' 1 ' +
            source +
            '\n' +
            command.source +
            '\ncommands[' +
            JSON.stringify(commandId) +
            '].apply(null, [' +
            JSON.stringify(commandContext()) +
            ']);');
    },
    _invokeGasCommand: function (command) {
        const manifest = this.options.manifest;
        if (!manifest.gasContext) {
            console.warn('extension ' +
                this.options.id +
                ': command ' +
                command.id +
                ' has no cached gasContext');
            return;
        }
        const seq = this._nextCommandCallId++;
        const callId = 'cmd-' + this.options.id + '-' + seq;
        const proxyId = 'gas-cmd-proxy-' + this.options.id + '-' + seq;
        registerGasProxy(this.map, proxyId, this.options.id);
        const releaseProxy = () => {
            delete gasProxies[proxyId];
        };
        this._pendingCommandCalls[callId] = {
            onSuccess: (value) => {
                releaseProxy();
                // Show each getUi().alert() as a snackbar; open the sidebar if a
                // ui.showSidebar named a file:
                const envelope = value;
                if (!envelope || envelope.__coolGas !== true)
                    return;
                for (const alert of envelope.alerts || []) {
                    if (!this.map.uiManager)
                        break;
                    this.map.uiManager.showSnackbar(alert.title ? alert.title + ': ' + alert.message : alert.message);
                }
                this._openGasEnvelopeUi(envelope);
            },
            onError: (err) => {
                releaseProxy();
                console.error('extension ' +
                    this.options.id +
                    ': command ' +
                    command.id +
                    ' failed:', err);
                if (this.map.uiManager) {
                    this.map.uiManager.showSnackbar(_('Extension command failed: %1').replace('%1', err.message));
                }
            },
        };
        setTimeout(() => {
            const pending = this._pendingCommandCalls[callId];
            if (!pending)
                return;
            delete this._pendingCommandCalls[callId];
            pending.onError(new Error('timed out waiting for a response'));
        }, 30000);
        this._sendGasRunner(callId, proxyId, command.gasFunctionName, command.gasArguments || []);
    },
    // Open the sidebar and the dialog that the add-on asked for in a GAS runner result:
    _openGasEnvelopeUi: function (envelope) {
        if (typeof envelope.sidebarFile === 'string' && envelope.sidebarFile) {
            this._openPanel(envelope.sidebarFile);
        }
        if (envelope.dialog) {
            this._openGasDialog(envelope.dialog);
        }
    },
    // Run the add-on's function functionName with args in the kit, through the GAS runner:
    _sendGasRunner: function (callId, proxyId, functionName, functionArgs) {
        app.socket.sendMessage(gasRunnerMessage(callId, proxyId, this.options.id, this.options.manifest.gasContext, functionName, functionArgs));
    },
    // Run the add-on function that a GAS add-on frame asked for, with the proxy of its
    // XClientRuntime served here:
    _runGasFunction: function (msg) {
        const manifest = this.options.manifest;
        if (!manifest.isGasExtension || !manifest.gasContext) {
            console.warn('extension ' +
                this.options.id +
                ': ' +
                msg.msgId +
                ' is only for GAS add-ons with a cached gasContext');
            return;
        }
        // As in GAS, google.script.run cannot call a private function, whose name ends in
        // "_", and the reserved names __coolGasMenu and __coolGasCommand name none of the
        // add-on's functions:
        if (typeof msg.functionName !== 'string' ||
            msg.functionName.endsWith('_') ||
            msg.functionName === '__coolGasMenu' ||
            msg.functionName === '__coolGasCommand') {
            this._postToCaller(msg.callId, {
                msgId: 'Extension_CallResult',
                callId: msg.callId,
                err: 'Apps Script function not defined: ' + msg.functionName,
            });
            return;
        }
        const seq = this._nextCommandCallId++;
        const callId = 'gasrun-' + this.options.id + '-' + seq;
        const proxyId = 'gas-run-proxy-' + this.options.id + '-' + seq;
        const frame = this._callerWindow(msg.callId);
        registerGasProxy(this.map, proxyId, this.options.id);
        gasProxies[proxyId].frame = frame;
        this._pendingGasRuns[callId] = {
            frame: frame,
            frameCallId: msg.callId,
            proxyId: proxyId,
        };
        this._sendGasRunner(callId, proxyId, msg.functionName, msg.args || []);
    },
    _readGasFile: async function (msg) {
        const frame = this._callerWindow(msg.callId);
        const reply = (ok, err) => {
            this._postToWindow(frame, {
                msgId: 'Extension_CallResult',
                callId: msg.callId,
                ok: ok,
                err: err,
            });
        };
        const base = new URL(this.options.baseUrl, document.baseURI);
        let url;
        try {
            url = new URL(msg.url, base);
        }
        catch (e) {
            reply(undefined, msg.url + ': ' + e.message);
            return;
        }
        if (!url.href.startsWith(base.href)) {
            reply(undefined, msg.url + ' is outside the add-on directory');
            return;
        }
        try {
            const resp = await fetch(url.href);
            if (!resp.ok) {
                reply(undefined, msg.url + ' HTTP ' + resp.status);
                return;
            }
            reply(await resp.text());
        }
        catch (e) {
            reply(undefined, msg.url + ': ' + e.message);
        }
    },
    _handleGasStorageMessage: function (msg) {
        const prefix = 'gas-local-storage:' + this.options.id + ':';
        if (msg.msgId === 'Extension_GasStorageLoad') {
            const items = Object.create(null);
            for (let i = 0; i < localStorage.length; ++i) {
                const k = localStorage.key(i);
                if (k !== null && k.startsWith(prefix)) {
                    items[k.substring(prefix.length)] = localStorage.getItem(k);
                }
            }
            this._postToCaller(msg.callId, {
                msgId: 'Extension_CallResult',
                callId: msg.callId,
                ok: items,
            });
        }
        else if (msg.value === null) {
            localStorage.removeItem(prefix + msg.key);
        }
        else {
            try {
                localStorage.setItem(prefix + msg.key, msg.value);
            }
            catch (e) {
                console.warn('extension ' + this.options.id + ': localStorage write failed:', e);
            }
        }
    },
    // A `panel: true` command: make sure the sidebar panel is showing, then
    // hand the command id to the iframe. The iframe may still be loading, in
    // which case the message goes out once it has loaded.
    invokePanelCommand: function (commandId) {
        const sidebar = this.map.sidebar;
        if (!sidebar)
            return;
        const deliver = () => {
            this._postToIframe({ msgId: 'Extension_Command', commandId: commandId });
        };
        if (sidebar.hasExtensionDeck(this) && this._iframe) {
            deliver();
            return;
        }
        if (this._panel)
            this._finishRemovePanel();
        this._showPanel();
        if (!this._panel)
            return;
        sidebar.takeExtensionDeckSlot(this);
        this._setToolitemHighlight(true);
        if (this._iframe) {
            this._iframe.addEventListener('load', deliver, { once: true });
        }
    },
    // Dispatcher entry point.  The notebookbar Extensions tab fires
    // extension-toggle-<id>.  An extension shows as its own sidebar deck, so the
    // toolitem toggles it the way the core deck buttons beside it do: clicking the
    // extension that is already showing takes it down again.
    toggle: function () {
        const sidebar = this.map.sidebar;
        if (!sidebar)
            return;
        if (sidebar.hasExtensionDeck(this)) {
            this._closeExtension();
            return;
        }
        if (this._panel)
            this._finishRemovePanel();
        this._showPanel();
        if (!this._panel)
            return;
        sidebar.takeExtensionDeckSlot(this);
        this._setToolitemHighlight(true);
    },
    _setToolitemHighlight: function (on) {
        const command = 'extension-toggle-' + this.options.id;
        const state = on ? 'true' : 'false';
        this.map['stateChangeHandler'].setItemValue(command, state);
        this.map.fire('commandstatechanged', {
            commandName: command,
            state: state,
        });
    },
    closeDeck: function () {
        if (this._panel)
            this._panel.classList.add('closing');
        this._setToolitemHighlight(false);
        this.map.sidebar.releaseExtensionDeckSlot(this);
        this._removePanel();
    },
    _closeExtension: function () {
        this.closeDeck();
        this.map.sidebar.closeSidebar();
        app.socket.sendMessage('uno .uno:SidebarHide');
    },
    // The URL of gas-wrapper.html showing the add-on page named file, with params carrying any
    // further query parameters:
    _gasWrapperUrl: function (file, params) {
        const manifest = this.options.manifest;
        params.set('base', new URL(this.options.baseUrl, document.baseURI).href);
        if (manifest.gasContext && manifest.gasContext.names.length) {
            params.set('scripts', manifest.gasContext.names.join(','));
        }
        params.set('sidebar', file + (/\.html?$/i.test(file) ? '' : '.html'));
        return new URL(this.options.baseUrl + '../gas-wrapper.html?' + params.toString(), document.baseURI).href;
    },
    _openGasDialog: function (spec) {
        // One modal at a time per extension, and the add-on's second request is dropped:
        if (this._dialog) {
            console.warn('extension ' +
                this.options.id +
                ': dialog ' +
                spec.file +
                ' requested while another one is open');
            return;
        }
        const params = new URLSearchParams();
        params.set('coolRole', 'dialog');
        if (spec.templateValues !== undefined) {
            params.set('template', JSON.stringify(spec.templateValues));
        }
        this._showDialogFrame(this._gasWrapperUrl(spec.file, params), {
            dialogId: null,
            title: spec.title,
            width: spec.width,
            height: spec.height,
        });
    },
    _showPanel: function (sidebarFile) {
        const manifest = this.options.manifest;
        const sidebarPanel = document.getElementById('sidebar-panel');
        if (!sidebarPanel)
            return;
        const shell = JSDialog.buildOverlaySidebarPanel({
            id: 'extension-' + this.options.id,
            title: manifest.name,
            cssClass: 'jsdialog sidebar',
            map: this.map,
            onClose: this._closeExtension.bind(this),
        });
        const panel = shell.container;
        panel.classList.add('extension-panel');
        panel.dataset.extensionId = this.options.id;
        shell.content.classList.add('extension-panel-body');
        // A GAS add-on has no manifest.entry; the iframe URL comes from gasContext plus the
        // ui.showSidebar argument the calling menu command captured in sidebarFile:
        let entryUrl;
        if (manifest.isGasExtension) {
            if (!manifest.gasContext || !sidebarFile)
                return;
            entryUrl = this._gasWrapperUrl(sidebarFile, new URLSearchParams());
        }
        else {
            entryUrl = this.options.baseUrl + manifest.entry;
        }
        const iframe = document.createElement('iframe');
        iframe.src = withUiLanguage(entryUrl);
        iframe.setAttribute('sandbox', manifest.isGasExtension ? gasFrameSandbox : nativeFrameSandbox);
        shell.content.appendChild(iframe);
        this._iframe = iframe;
        // Stop document-level shortcut handlers from intercepting keys/clicks
        // destined for the iframe contents:
        const stopProp = function (e) {
            e.stopPropagation();
        };
        [
            'keydown',
            'keyup',
            'keypress',
            'paste',
            'copy',
            'cut',
            'mousedown',
            'mouseup',
            'click',
        ].forEach(function (evt) {
            panel.addEventListener(evt, stopProp);
        });
        sidebarPanel.appendChild(panel);
        this._panel = panel;
    },
    _removePanel: function () {
        if (!this._panel)
            return;
        // If a teardown is already in flight, leave it to finish:
        if (this._teardownTimer !== null)
            return;
        // If the iframe isn't ready, skip the handshake (nothing to detach):
        if (this._iframe && this._iframe.contentWindow) {
            this._postToIframe({ msgId: 'Extension_Teardown' });
            this._teardownTimer = setTimeout(this._finishRemovePanel.bind(this), 1000);
        }
        else {
            this._finishRemovePanel();
        }
    },
    _finishRemovePanel: function () {
        if (this._teardownTimer !== null) {
            clearTimeout(this._teardownTimer);
            this._teardownTimer = null;
        }
        // A dialog owned by this extension outlives the sidebar iframe if we
        // don't dismiss it; no one would be left to receive the result either.
        if (this._dialog) {
            this._dialog.origRemove();
            this._dialog = null;
        }
        if (this._panel) {
            this._panel.remove();
            this._panel = null;
            this._iframe = null;
        }
    },
    _onPostMessage: function (e) {
        // Route by the sender window: our sidebar iframe speaks the sidebar
        // half of the protocol, our dialog iframe (when one is open) speaks
        // the dialog half.  Silently ignore everything else (browser
        // extensions, dev tools, third-party libs).
        const fromSidebar = this._iframe && e.source === this._iframe.contentWindow;
        const fromDialog = this._dialog &&
            e.source === this._dialog.iframeDialog._iframe.contentWindow;
        if (!fromSidebar && !fromDialog)
            return;
        let msg;
        try {
            msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        }
        catch (ex) {
            console.warn('postMessage is not JSON: ' + e.data);
            return;
        }
        if (!msg || typeof msg !== 'object') {
            console.warn('postMessage is not an object: ' + JSON.stringify(msg));
            return;
        }
        if (this.options.manifest.isGasExtension &&
            !gasFrameMessageIds.has(msg.msgId)) {
            console.warn('extension ' +
                this.options.id +
                ': ' +
                msg.msgId +
                ' is not for GAS add-ons');
            return;
        }
        if (fromSidebar) {
            this._handleSidebarMessage(msg);
        }
        else {
            this._handleDialogMessage(msg);
        }
    },
    // The sidebar and the dialog iframe both send these on to the kit:
    _forwardToKit: function (msg) {
        switch (msg.msgId) {
            case 'Extension_Call': {
                // Wire format `executescript <id> <line> <source>\n<script>`:
                app.socket.sendMessage('executescript ' +
                    msg.callId +
                    ' ' +
                    (msg.line - 1) +
                    ' ' +
                    msg.source.replace(/\n/g, '') +
                    '\n(\n' +
                    msg.fn +
                    '\n).apply(null, ' +
                    JSON.stringify(msg.args || []) +
                    ');');
                break;
            }
            case 'Extension_ProxyReturn':
                app.socket.sendMessage('proxyreturn ' +
                    msg.callId +
                    ' ' +
                    JSON.stringify(msg.value === undefined ? null : msg.value));
                break;
        }
    },
    _handleSidebarMessage: function (msg) {
        switch (msg.msgId) {
            case 'Extension_Call':
            case 'Extension_ProxyReturn':
                this._forwardToKit(msg);
                break;
            case 'Extension_GasReadFile':
                this._readGasFile(msg);
                break;
            case 'Extension_GasRun':
                this._runGasFunction(msg);
                break;
            case 'Extension_GasStorageLoad':
            case 'Extension_GasStorageSet':
                this._handleGasStorageMessage(msg);
                break;
            case 'Extension_Close':
                this._closeExtension();
                break;
            case 'Extension_UrlFetchResult':
                answerGasFrameFetch(msg, this._iframe && this._iframe.contentWindow);
                break;
            case 'Extension_TeardownDone':
                this._finishRemovePanel();
                break;
            case 'Extension_Resize':
                // The iframe of a GAS add-on fills the panel, as the add-on's page expects a frame
                // of a fixed height:
                if (this._iframe &&
                    !this.options.manifest.isGasExtension) {
                    this._iframe.style.height = msg.height + 'px';
                }
                break;
            case 'Extension_ShowDialog':
                this._openDialog(msg);
                break;
            case 'Extension_SaveFile':
                this._saveFile(msg);
                break;
            default:
                console.warn('unexpected msgId: ' + msg.msgId);
                break;
        }
    },
    // Save a file an extension generated. In the desktop app (CODA) it goes to
    // the native side, which shows a save panel; in the browser it downloads.
    // The result ("download" / "filesystem") is posted back so the extension's
    // cool.saveFile promise settles.
    _saveFile: function (msg) {
        const reply = (how, err) => {
            this._postToCaller(msg.saveId, {
                msgId: 'Extension_SaveFileResult',
                saveId: msg.saveId,
                how: how,
                err: err,
            });
        };
        let bytes;
        try {
            bytes = Uint8Array.from(msg.bytes || []);
        }
        catch (e) {
            reply(undefined, 'invalid file content');
            return;
        }
        const filename = (msg.filename || 'file').replace(/^.*[\\/]/, '');
        if (window.ThisIsAMobileApp) {
            // Hand the bytes to the native app (see the CODA/iOS extensionsavefile
            // handler), base64 so the message stays text.
            let binary = '';
            for (let i = 0; i < bytes.length; i++)
                binary += String.fromCharCode(bytes[i]);
            window.postMobileMessage('extensionsavefile name=' +
                encodeURIComponent(filename) +
                ' mime=' +
                encodeURIComponent(msg.mimeType || 'application/octet-stream') +
                ' data=' +
                btoa(binary));
            // The native side owns the save panel; report the platform, not success.
            reply('filesystem');
            return;
        }
        try {
            const blob = new Blob([bytes], {
                type: msg.mimeType || 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            reply('download');
        }
        catch (e) {
            reply(undefined, e.message);
        }
    },
    _handleDialogMessage: function (msg) {
        switch (msg.msgId) {
            case 'Extension_Call':
            case 'Extension_ProxyReturn':
                this._forwardToKit(msg);
                break;
            case 'Extension_GasReadFile':
                this._readGasFile(msg);
                break;
            case 'Extension_GasRun':
                this._runGasFunction(msg);
                break;
            case 'Extension_GasStorageLoad':
            case 'Extension_GasStorageSet':
                this._handleGasStorageMessage(msg);
                break;
            case 'Extension_DialogClose':
                this._closeDialog({ cancelled: false, value: msg.value });
                break;
            case 'Extension_DialogCancel':
                this._closeDialog({ cancelled: true });
                break;
            case 'Extension_ShowDialog':
                // A dialog is open while its page runs, so this resolves as cancelled at once:
                this._openDialog(msg);
                break;
            case 'Extension_SaveFile':
                this._saveFile(msg);
                break;
            case 'Extension_UrlFetchResult':
                answerGasFrameFetch(msg, this._dialog && this._dialog.iframeDialog._iframe.contentWindow);
                break;
            case 'Extension_Resize':
                // Dialog iframe reports its content's actual scrollHeight
                // (cool.js sends this on load and via ResizeObserver).  Fit
                // the iframe height so no empty space is left below.
                if (this._dialog) {
                    this._dialog.iframeDialog._iframe.style.height = msg.height + 'px';
                }
                break;
            default:
                console.warn('unexpected msgId: ' + msg.msgId);
                break;
        }
    },
    _openDialog: function (msg) {
        if (this._dialog) {
            // One modal at a time per extension; the second open() resolves as
            // cancelled straight away rather than queueing behind the first.
            this._postDialogResult(msg.dialogId, { cancelled: true });
            return;
        }
        const base = new URL(this.options.baseUrl, document.baseURI);
        const resolved = new URL(msg.url, base);
        // Check, just in case:
        if (!resolved.href.startsWith(base.href)) {
            console.warn('Extension_ShowDialog: url [' +
                msg.url +
                '] resolves outside baseUrl [' +
                base.href +
                ']; refusing');
            this._postDialogResult(msg.dialogId, { cancelled: true });
            return;
        }
        resolved.searchParams.set('coolRole', 'dialog');
        this._showDialogFrame(resolved.href, msg);
    },
    _showDialogFrame: function (url, msg) {
        const iframeOptions = {
            // Own prefix rather than iframe-dialog so extension-specific CSS
            // can stand on its own without disturbing the Feedback dialog.
            prefix: 'iframe-extension',
            titlebar: true,
            directSrc: true,
        };
        if (this.options.manifest.isGasExtension) {
            iframeOptions.sandbox = gasFrameSandbox;
        }
        if (msg.title !== undefined)
            iframeOptions.title = msg.title;
        const iframeDialog = window.L.iframeDialog(withUiLanguage(url), {}, null, iframeOptions);
        // Size on the wrap, not on the iframe: the wrap is the visible dialog
        // box, and the iframe fills it via width: 100% and the height that
        // Extension_Resize keeps in sync with the picker's actual content.
        if (msg.width !== undefined) {
            iframeDialog._container.style.width = msg.width + 'px';
        }
        if (msg.height !== undefined) {
            iframeDialog._iframe.style.height = msg.height + 'px';
        }
        const origRemove = iframeDialog.remove.bind(iframeDialog);
        // Titlebar X and in-iframe Esc both call remove() directly.  Turn
        // either of those user gestures into a cancel result on the sidebar
        // side; the code path from _closeDialog uses origRemove and does not
        // re-enter this override.
        iframeDialog.remove = () => {
            origRemove();
            if (this._dialog && this._dialog.iframeDialog === iframeDialog) {
                const dialogId = this._dialog.dialogId;
                this._dialog = null;
                this._postDialogResult(dialogId, { cancelled: true });
            }
        };
        this._dialog = {
            iframeDialog: iframeDialog,
            origRemove: origRemove,
            dialogId: msg.dialogId,
        };
        iframeDialog.show();
    },
    _closeDialog: function (result) {
        if (!this._dialog)
            return;
        const dialogId = this._dialog.dialogId;
        const origRemove = this._dialog.origRemove;
        this._dialog = null;
        origRemove();
        this._postDialogResult(dialogId, result);
    },
    _postDialogResult: function (dialogId, result) {
        if (dialogId === null)
            return;
        this._postToCaller(dialogId, {
            msgId: 'Extension_DialogResult',
            dialogId: dialogId,
            cancelled: result.cancelled,
            value: result.cancelled ? null : result.value,
        });
    },
    // Reconstructs a proper Error from the engine's jsuno::Exception payload, the
    // same way cool.js's makeStructuredError does for a cool.callRemote call: the
    // stack text lets the browser console show the command's own source location
    // for each frame rather than just a bare message.
    _toScriptError: function (err) {
        if (typeof err === 'string')
            return new Error(err);
        const e = new Error(err.message || '');
        e.name = err.name || 'Error';
        let stackText = e.name + ': ' + e.message;
        for (const f of err.stack || []) {
            stackText +=
                '\n    at ' +
                    (f.functionName || '<anonymous>') +
                    ' (' +
                    (f.source || '') +
                    ':' +
                    f.line +
                    ':' +
                    f.column +
                    ')';
        }
        e.stack = stackText;
        return e;
    },
    _onScriptResult: function (e) {
        const pending = this._pendingCommandCalls[e.id];
        const gasRun = this._pendingGasRuns[e.id];
        if (pending) {
            delete this._pendingCommandCalls[e.id];
            if (e.err !== undefined)
                pending.onError(this._toScriptError(e.err));
            else
                pending.onSuccess(e.ok);
        }
        else if (gasRun) {
            delete this._pendingGasRuns[e.id];
            delete gasProxies[gasRun.proxyId];
            const envelope = e.ok;
            if (e.err === undefined && envelope && envelope.__coolGas === true) {
                this._openGasEnvelopeUi(envelope);
            }
            this._postToWindow(gasRun.frame, {
                msgId: 'Extension_CallResult',
                callId: gasRun.frameCallId,
                ok: e.ok,
                err: e.err,
            });
        }
        else {
            this._postToCaller(e.id, {
                msgId: 'Extension_CallResult',
                callId: e.id,
                ok: e.ok,
                err: e.err,
            });
        }
        if (e.legacyUnoApi) {
            this.map.uiManager.showLegacyUnoApiSnackbarOnce();
        }
    },
    _openPanel: function (sidebarFile) {
        const sidebar = this.map.sidebar;
        if (!sidebar)
            return;
        if (sidebar.hasExtensionDeck(this))
            return;
        if (this._panel)
            this._finishRemovePanel();
        this._showPanel(sidebarFile);
        if (!this._panel)
            return;
        sidebar.takeExtensionDeckSlot(this);
        this._setToolitemHighlight(true);
    },
});
window.L.control.extension = function (id, manifest, baseUrl) {
    return new window.L.Control.Extension({
        position: 'topleft',
        id: id,
        manifest: manifest,
        baseUrl: baseUrl,
    });
};
// A page loaded from file:// gets status 0 for a local file it has read:
function responseSucceeded(resp) {
    return resp.ok || (resp.status === 0 && window.location.protocol === 'file:');
}
// Every command of an Apps Script add-on runs as a call to the runner in the kit's prelude, which
// gets the add-on's own sources as string literals and evaluates each one under its own file
// name, so an exception's frames name the add-on's file.
// If the directory carries appsscript.json, synthesize a manifest for its Apps Script
// add-on from what a __coolGasMenu invocation of the runner brings back at extension-load
// time; the _cool-gas.json sidecar lists .gs sources:
async function tryLoadAppsScriptExtension(id, baseRel, map) {
    const gasResp = await fetch(app.LOUtil.getURL(baseRel + 'appsscript.json'));
    if (!responseSucceeded(gasResp))
        return null;
    const libraries = await loadGasLibraries(id, baseRel, await gasResp.json());
    let listing = {};
    try {
        const listResp = await fetch(app.LOUtil.getURL(baseRel + '_cool-gas.json'));
        if (responseSucceeded(listResp))
            listing = await listResp.json();
    }
    catch {
        // Missing sidecar is not fatal; discovery continues with no scripts.
    }
    // An add-on can have a _cool-gas-manifest.json with fields of a native extension's
    // manifest.json, which take precedence over what discovery derived from its sources:
    let gasManifest = {};
    let gasManifestResp = null;
    try {
        gasManifestResp = await fetch(app.LOUtil.getURL(baseRel + '_cool-gas-manifest.json'));
    }
    catch {
        // A file: URL of a missing file fails the fetch rather than answering 404.
    }
    if (gasManifestResp && responseSucceeded(gasManifestResp)) {
        try {
            const parsed = await gasManifestResp.json();
            if (typeof parsed !== 'object' ||
                parsed === null ||
                Array.isArray(parsed))
                throw new Error('not an object');
            gasManifest = parsed;
        }
        catch (e) {
            console.warn('extension ' + id + ': malformed _cool-gas-manifest.json: ' + e);
        }
    }
    const manifest = {
        manifestVersion: gasManifest.manifestVersion === undefined
            ? '0.1'
            : gasManifest.manifestVersion,
        name: gasManifest.name || listing.name || id,
        isGasExtension: true,
    };
    if (gasManifest.icon)
        manifest.icon = gasManifest.icon;
    const supports = gasManifest.supports !== undefined
        ? gasManifest.supports
        : listing.supports;
    if (supports && supports.length) {
        manifest.supports = supports;
    }
    const scriptNames = listing.scripts || [];
    let items = [];
    if (scriptNames.length) {
        try {
            items = await collectGasAddonMenu(id, baseRel, scriptNames, libraries, map);
        }
        catch (err) {
            console.warn('extension ' + id + ': __coolGasMenu invocation failed:', err);
        }
    }
    // The add-on menu the runner brought back becomes one command per item, offered under
    // the add-on's name where an editor add-on's menu belongs.  (Two items pointing at the same
    // GAS function each keep their own caption by getting their own command id.)
    const commands = [];
    const placement = [];
    const usedIds = new Set();
    for (const item of items) {
        if (!item.functionName) {
            // Two dividers in a row, or one before any item, would render as a stray line.
            if (placement.length &&
                !('separator' in placement[placement.length - 1])) {
                placement.push({ separator: true });
            }
            continue;
        }
        let commandId = item.functionName;
        let n = 2;
        while (usedIds.has(commandId)) {
            commandId = item.functionName + ':' + n;
            n++;
        }
        usedIds.add(commandId);
        commands.push({
            id: commandId,
            title: item.caption || item.functionName,
            gasFunctionName: item.functionName,
        });
        placement.push({ command: commandId });
    }
    while (placement.length && 'separator' in placement[placement.length - 1]) {
        placement.pop();
    }
    // An add-on can have the same contributions as a native extension, in the file that its
    // _cool-gas-manifest.json names, whose commands each name one of the add-on's own server files
    // as their script, where the add-on's __coolGasCommands object has the command's function:
    let contributes = {};
    if (gasManifest.contributes) {
        try {
            const contributesResp = await fetch(app.LOUtil.getURL(baseRel + gasManifest.contributes));
            if (!responseSucceeded(contributesResp))
                throw new Error('HTTP ' + contributesResp.status);
            contributes = await contributesResp.json();
        }
        catch (err) {
            console.warn('extension ' +
                id +
                ': contributes file "' +
                gasManifest.contributes +
                '" unreadable:', err);
        }
    }
    for (const command of contributes.commands || []) {
        if (!command.script || !scriptNames.includes(command.script)) {
            console.warn('extension ' +
                id +
                ': command ' +
                command.id +
                " does not name one of the add-on's scripts");
            continue;
        }
        if (usedIds.has(command.id)) {
            console.warn('extension ' + id + ': command ' + command.id + ' is already defined');
            continue;
        }
        usedIds.add(command.id);
        commands.push({
            id: command.id,
            title: command.title,
            icon: command.icon,
            gasFunctionName: '__coolGasCommand',
            gasArguments: [command.id],
        });
    }
    // Cache the .gs sources so a menu click doesn't refetch them:
    if (commands.length && scriptNames.length) {
        try {
            const sources = await Promise.all(scriptNames.map(async (name) => {
                const resp = await fetch(app.LOUtil.getURL(baseRel + name));
                if (!responseSucceeded(resp)) {
                    throw new Error(baseRel + name + ' HTTP ' + resp.status);
                }
                return await resp.text();
            }));
            manifest.gasContext = {
                sources: sources,
                names: scriptNames,
                libraries: libraries,
            };
            manifest.contributes = {
                ...contributes,
                commands: commands,
                extensionsMenu: placement,
            };
        }
        catch (err) {
            console.warn('extension ' + id + ': Apps Script sources unreadable:', err);
        }
    }
    return manifest;
}
// Ask the runner for the menu items the add-on's onOpen() puts together, at extension load:
let nextGasCollectId = 0;
// The libraries that an appsscript.json declares, loaded from the add-on's _cool-gas-libraries
// directory together with the libraries that each of them declares in turn:
async function loadGasLibraries(id, baseRel, appsscript) {
    const declared = (appsscript.dependencies && appsscript.dependencies.libraries) || [];
    const libraries = await Promise.all(declared.map(async (library) => {
        const dir = '_cool-gas-libraries/' +
            library.libraryId +
            '/' +
            (library.developmentMode ? 'HEAD' : String(library.version)) +
            '/';
        const fetchFile = async (name) => {
            const resp = await fetch(app.LOUtil.getURL(baseRel + dir + name));
            if (!responseSucceeded(resp)) {
                throw new Error(baseRel + dir + name + ' HTTP ' + resp.status);
            }
            return resp;
        };
        const listResp = await fetch(app.LOUtil.getURL(baseRel + dir + '_cool-gas.json'));
        if (!responseSucceeded(listResp)) {
            console.warn('extension ' +
                id +
                ': Apps Script library ' +
                library.userSymbol +
                ' is missing from ' +
                dir +
                ' (see scripts/gas/fetch-gas-addon.py)');
            return null;
        }
        const scripts = (await listResp.json()).scripts;
        const [sources, manifest] = await Promise.all([
            Promise.all(scripts.map(async (name) => (await fetchFile(name)).text())),
            fetchFile('appsscript.json').then((resp) => resp.json()),
        ]);
        return {
            userSymbol: library.userSymbol,
            dir: dir,
            scripts: scripts,
            sources: sources,
            libraries: await loadGasLibraries(id, baseRel, manifest),
        };
    }));
    return libraries.filter((library) => library !== null);
}
// The proxy calls that the Extension controls are passing on, by call id, each with whether one of
// the controls found a frame for it:
const proxyCallDeliveries = new Map();
// The XClientRuntime proxies that the main window serves itself, by proxy id, each with the id of
// the extension whose runner calls it, and for the call of a GAS add-on frame that frame's window:
const gasProxies = {};
let gasProxyMap = null;
const nativeFrameSandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
// A GAS add-on frame has an origin of its own, as an HtmlService page has in GAS, and so do its
// popups.  The desktop apps load extensions over file://, where a frame with an origin of its own
// cannot load its scripts, so there it keeps the sandbox of a native extension's frame:
const gasFrameSandbox = window.location.protocol.startsWith('http')
    ? 'allow-scripts allow-forms allow-popups allow-modals allow-downloads'
    : nativeFrameSandbox;
// The messages that GAS add-on frames need:
const gasFrameMessageIds = new Set([
    'Extension_Close',
    'Extension_DialogCancel',
    'Extension_DialogClose',
    'Extension_GasReadFile',
    'Extension_GasRun',
    'Extension_GasStorageLoad',
    'Extension_GasStorageSet',
    'Extension_Resize',
    'Extension_TeardownDone',
    'Extension_UrlFetchResult',
]);
function registerGasProxy(map, proxyId, extensionId) {
    if (gasProxyMap !== map) {
        if (gasProxyMap)
            gasProxyMap.off('proxycall', answerGasProxyCall);
        map.on('proxycall', answerGasProxyCall);
        gasProxyMap = map;
    }
    gasProxies[proxyId] = {
        extensionId: extensionId,
        handlers: makeGasProxyHandlers(extensionId),
    };
}
function answerGasProxyCall(e) {
    const proxy = gasProxies[e.proxyId];
    if (!proxy)
        return;
    const handler = proxy.handlers;
    const send = (value) => {
        if (!e.callId)
            return;
        app.socket.sendMessage('proxyreturn ' +
            e.callId +
            ' ' +
            JSON.stringify(value === undefined ? null : value));
    };
    const onThrow = (err) => {
        console.warn('extension ' +
            proxy.extensionId +
            ': proxy method ' +
            e.method +
            ' threw:', err);
        send(null);
    };
    // A GAS add-on frame makes its UrlFetchApp requests itself, where the
    // Content-Security-Policy of cool.html does not apply:
    const fn = e.method === 'urlFetch' && proxy.frame !== undefined
        ? (...args) => fetchThroughGasFrame(proxy.frame, args)
        : handler[e.method];
    try {
        // A handler may return a Promise (urlFetch does): wait for it before
        // sending proxyreturn, so a non-void async method blocks the kit-side
        // caller for the real answer instead of getting null immediately.
        const result = fn ? fn(...e.args) : null;
        if (result && typeof result.then === 'function') {
            result.then(send, onThrow);
        }
        else {
            send(result);
        }
    }
    catch (err) {
        onThrow(err);
    }
}
// The UrlFetchApp requests that GAS add-on frames are making for the main window, by request ID:
const gasFrameFetches = new Map();
let nextGasFrameFetchId = 0;
let gasFrameFetchWatch = null;
const gasFrameGoneResult = {
    code: 0,
    headerNames: [],
    headerValues: [],
    body: '',
    error: 'the frame that made the call is gone',
};
// Have frame make the UrlFetchApp request whose urlFetch arguments are args.  The requests of a
// frame that goes away get gasFrameGoneResult, as the kit waits for every answer:
function fetchThroughGasFrame(frame, args) {
    return new Promise((resolve) => {
        if (!frame || frame.closed) {
            resolve(gasFrameGoneResult);
            return;
        }
        const requestId = String(nextGasFrameFetchId++);
        gasFrameFetches.set(requestId, { frame: frame, resolve: resolve });
        if (gasFrameFetchWatch === null) {
            gasFrameFetchWatch = setInterval(() => {
                gasFrameFetches.forEach((request, id) => {
                    if (request.frame.closed) {
                        gasFrameFetches.delete(id);
                        request.resolve(gasFrameGoneResult);
                    }
                });
                if (gasFrameFetches.size === 0) {
                    clearInterval(gasFrameFetchWatch);
                    gasFrameFetchWatch = null;
                }
            }, 1000);
        }
        frame.postMessage(JSON.stringify({
            msgId: 'Extension_UrlFetch',
            requestId: requestId,
            args: args,
        }), '*');
    });
}
function answerGasFrameFetch(msg, frame) {
    const request = gasFrameFetches.get(msg.requestId);
    if (!request || request.frame !== frame) {
        console.warn('Extension_UrlFetchResult: unknown requestId ' + msg.requestId);
        return;
    }
    gasFrameFetches.delete(msg.requestId);
    request.resolve(msg.value);
}
// The cache entries of all add-ons share a budget of a million characters, well below the
// localStorage quota that COOL's own settings need too, and storing one drops the expired entries
// and, as far as needed, those that expire soonest:
function storeGasCacheEntry(storageKey, envelope) {
    const now = Date.now();
    const entries = [];
    const expired = [];
    let used = 0;
    for (let i = 0; i < localStorage.length; ++i) {
        const k = localStorage.key(i);
        if (k === null || !k.startsWith('gas-cache:') || k === storageKey)
            continue;
        const raw = localStorage.getItem(k) || '';
        let exp = 0;
        try {
            exp = JSON.parse(raw).exp;
        }
        catch (_) {
            /* dropped as expired */
        }
        if (typeof exp !== 'number' || exp <= now) {
            expired.push(k);
        }
        else {
            entries.push({ key: k, exp: exp, size: k.length + raw.length });
            used += k.length + raw.length;
        }
    }
    for (const k of expired)
        localStorage.removeItem(k);
    entries.sort((a, b) => a.exp - b.exp);
    const size = storageKey.length + envelope.length;
    let next = 0;
    while (used + size > 1000000 && next < entries.length) {
        const entry = entries[next++];
        localStorage.removeItem(entry.key);
        used -= entry.size;
    }
    // A value that does not fit is not cached, which GAS allows as well:
    for (;;) {
        if (used + size > 1000000) {
            localStorage.removeItem(storageKey);
            return;
        }
        try {
            localStorage.setItem(storageKey, envelope);
            return;
        }
        catch (_) {
            if (next === entries.length) {
                localStorage.removeItem(storageKey);
                return;
            }
            const entry = entries[next++];
            localStorage.removeItem(entry.key);
            used -= entry.size;
        }
    }
}
function makeGasProxyHandlers(extensionId) {
    const prefix = 'gas-user-props:' + extensionId + ':';
    const propKeys = () => {
        const out = [];
        for (let i = 0; i < localStorage.length; ++i) {
            const k = localStorage.key(i);
            if (k !== null && k.indexOf(prefix) === 0) {
                out.push(k.substring(prefix.length));
            }
        }
        return out;
    };
    const cacheKey = (scope, key) => 'gas-cache:' + extensionId + ':' + scope + ':' + key;
    return {
        translate: () => {
            throw new Error('LanguageApp.translate is not supported in the COOL Apps Script wrapper');
        },
        userPropGetProperty: (...args) => {
            const key = String(args[0]);
            const raw = localStorage.getItem(prefix + key);
            return { IsPresent: raw !== null, Value: raw === null ? '' : raw };
        },
        userPropSetProperty: (...args) => {
            localStorage.setItem(prefix + String(args[0]), String(args[1]));
        },
        userPropDeleteProperty: (...args) => {
            localStorage.removeItem(prefix + String(args[0]));
        },
        userPropGetKeys: () => propKeys(),
        userPropDeleteAll: () => {
            for (const k of propKeys())
                localStorage.removeItem(prefix + k);
        },
        cacheGet: (...args) => {
            const scope = String(args[0]);
            const key = String(args[1]);
            const raw = localStorage.getItem(cacheKey(scope, key));
            if (raw === null)
                return { IsPresent: false, Value: '' };
            try {
                const parsed = JSON.parse(raw);
                if (parsed &&
                    typeof parsed.exp === 'number' &&
                    Date.now() < parsed.exp) {
                    return { IsPresent: true, Value: String(parsed.v) };
                }
            }
            catch (_) {
                /* fall through and drop */
            }
            localStorage.removeItem(cacheKey(scope, key));
            return { IsPresent: false, Value: '' };
        },
        cachePut: (...args) => {
            const scope = String(args[0]);
            const key = String(args[1]);
            const value = String(args[2]);
            const ttl = Math.max(0, Number(args[3]));
            const envelope = JSON.stringify({
                v: value,
                exp: Date.now() + ttl * 1000,
            });
            storeGasCacheEntry(cacheKey(scope, key), envelope);
        },
        cacheRemove: (...args) => {
            localStorage.removeItem(cacheKey(String(args[0]), String(args[1])));
        },
        // The script waits for the answer, so the dialog answers once, with CLOSE when it is
        // closed without a button:
        alert: (...args) => new Promise((resolve) => {
            const labels = {
                OK: _('OK'),
                CANCEL: _('Cancel'),
                YES: _('Yes'),
                NO: _('No'),
            };
            const buttonSets = {
                OK: ['OK'],
                OK_CANCEL: ['OK', 'CANCEL'],
                YES_NO: ['YES', 'NO'],
                YES_NO_CANCEL: ['YES', 'NO', 'CANCEL'],
            };
            const names = buttonSets[String(args[2])] || buttonSets.OK;
            let answered = false;
            const answer = (name) => {
                if (answered)
                    return;
                answered = true;
                resolve(name);
            };
            const callbacks = names.map((name) => ({
                id: 'gas-alert-' + name,
                func_: () => answer(name),
            }));
            callbacks.push({ id: 'response-cancel', func: () => answer('CLOSE') }, { id: '__POPOVER__', func: () => answer('CLOSE') });
            gasProxyMap.uiManager.showModalWithCustomButtons('gas-alert', String(args[0]), String(args[1]), true, names.map((name) => ({
                id: 'gas-alert-' + name,
                text: labels[name],
            })), callbacks);
        }),
        urlFetch: async (...args) => {
            const url = String(args[0]);
            const method = String(args[1]);
            const contentType = String(args[2]);
            const payload = String(args[3]);
            const payloadIsBase64 = Boolean(args[4]);
            const headerNames = args[5];
            const headerValues = args[6];
            const followRedirects = Boolean(args[7]);
            const headers = {};
            for (let i = 0; i < headerNames.length; ++i) {
                headers[headerNames[i]] = headerValues[i];
            }
            if (contentType)
                headers['Content-Type'] = contentType;
            try {
                const body = method === 'GET' || method === 'HEAD'
                    ? undefined
                    : payloadIsBase64
                        ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
                        : payload;
                const resp = await fetch(url, {
                    method: method,
                    headers: headers,
                    body: body,
                    redirect: followRedirects ? 'follow' : 'manual',
                });
                const buf = await resp.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i += 0x8000) {
                    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
                }
                const outNames = [];
                const outValues = [];
                resp.headers.forEach((v, k) => {
                    outNames.push(k);
                    outValues.push(v);
                });
                return {
                    code: resp.status,
                    headerNames: outNames,
                    headerValues: outValues,
                    body: btoa(binary),
                    error: '',
                };
            }
            catch (err) {
                return {
                    code: 0,
                    headerNames: [],
                    headerValues: [],
                    body: '',
                    error: err && err.message
                        ? err.message
                        : String(err),
                };
            }
        },
    };
}
async function collectGasAddonMenu(id, baseRel, scriptNames, libraries, map) {
    const sources = await Promise.all(scriptNames.map(async (s) => {
        const resp = await fetch(app.LOUtil.getURL(baseRel + s));
        if (!responseSucceeded(resp))
            throw new Error(baseRel + s + ' HTTP ' + resp.status);
        return await resp.text();
    }));
    const seq = nextGasCollectId++;
    const callId = 'gas-collect-' + id + '-' + seq;
    const proxyId = 'gas-collect-proxy-' + id + '-' + seq;
    registerGasProxy(map, proxyId, id);
    return new Promise((resolve, reject) => {
        const handler = (result) => {
            if (result.id !== callId)
                return;
            map.off('executescriptresult', handler);
            delete gasProxies[proxyId];
            if (result.err) {
                const msg = (result.err && result.err.message) ||
                    String(result.err) ||
                    'GAS collect failed';
                reject(new Error(msg));
                return;
            }
            // The runner wraps every return in a __coolGas envelope whose value is the menu:
            const envelope = result.ok;
            const value = envelope && envelope.__coolGas === true ? envelope.value : result.ok;
            resolve(Array.isArray(value) ? value : []);
        };
        map.on('executescriptresult', handler);
        app.socket.sendMessage(gasRunnerMessage(callId, proxyId, id, { sources, names: scriptNames, libraries }, '__coolGasMenu', []));
    });
}
// The executescript message that runs the add-on's function functionName with functionArgs in
// the kit, through the GAS runner that the kit has in its prelude:
function gasRunnerMessage(callId, proxyId, extensionId, gc, functionName, functionArgs) {
    const args = '[' +
        JSON.stringify(proxyId) +
        ', ' +
        JSON.stringify(gc.sources) +
        ', ' +
        JSON.stringify(gc.names) +
        ', ' +
        JSON.stringify(functionName) +
        ', ' +
        JSON.stringify(functionArgs) +
        ', ' +
        JSON.stringify(extensionId) +
        ', ' +
        JSON.stringify(gc.libraries) +
        ']';
    return ('executescript ' +
        callId +
        ' 1 <gas-call>\n$internal.runGasAddOn.apply(null, ' +
        args +
        ');');
}
// --- Localization ------------------------------------------------------------------------------
//
// Extensions are translated with gettext catalogs, like the rest of the UI: an
// extension ships `l10n/<lang>.json` files (built by util/po2json.py from its
// po/<lang>.po, see browser/extensions/README.md). The English strings in
// manifest.json and the contributes file are the msgids. Discovery loads the
// catalog for the UI language once per extension and translates the manifest
// in place, so every consumer (notebookbar, menus, context menu, panel header)
// sees translated text without knowing about catalogs. The panel iframe and
// kit-side commands get the language too, and cool.js loads the same catalog
// for the panel's own strings.
// The UI language as COOL knows it, e.g. "en-US", "pt-BR", "de".
function uiLanguage() {
    return window.langParam || 'en-US';
}
function uiDirection() {
    return document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
}
// Catalog file names use the po file convention: pt_BR, zh_CN, ca_valencia.
// For "pt-BR" try pt_BR then pt; for "de" just de. English has no catalog.
function catalogCandidates(lang) {
    const norm = lang.replace(/-/g, '_');
    const parts = norm.split('_');
    if (parts[0] === 'en')
        return [];
    const out = [norm];
    if (parts.length > 1)
        out.push(parts[0]);
    return out;
}
// Append the UI language and direction to an extension page URL.
function withUiLanguage(url) {
    const u = new URL(url, document.baseURI);
    u.searchParams.set('lang', uiLanguage());
    u.searchParams.set('dir', uiDirection());
    return u.href;
}
// The object passed to kit-side command functions as their argument.
function commandContext() {
    return { lang: uiLanguage(), dir: uiDirection() };
}
const catalogCache = {};
// Fetch the extension's catalog for the UI language, or null when there is
// none. 404s are the normal case for untranslated extensions and are silent.
function loadExtensionCatalog(baseRel) {
    if (catalogCache[baseRel])
        return catalogCache[baseRel];
    catalogCache[baseRel] = (async () => {
        // Fetch the candidates (pt_BR, pt) together; the most specific one
        // that exists wins.
        const fetched = await Promise.all(catalogCandidates(uiLanguage()).map(async (cand) => {
            try {
                const resp = await fetch(app.LOUtil.getURL(baseRel + 'l10n/' + cand + '.json'));
                if (!responseSucceeded(resp))
                    return null;
                const catalog = await resp.json();
                return catalog && typeof catalog === 'object' ? catalog : null;
            }
            catch (err) {
                return null;
            }
        }));
        return fetched.find((catalog) => catalog !== null) || null;
    })();
    return catalogCache[baseRel];
}
// Translate the user-visible strings of a manifest (and its resolved
// contributes object) in place; msgids without a translation stay English.
async function localizeManifest(manifest, baseRel) {
    const catalog = await loadExtensionCatalog(baseRel);
    if (!catalog)
        return;
    const tr = (s) => s !== undefined &&
        Object.prototype.hasOwnProperty.call(catalog, s) &&
        catalog[s] !== ''
        ? catalog[s]
        : s;
    manifest.name = tr(manifest.name);
    const c = manifest.contributes;
    if (!c)
        return;
    if (c.commands)
        for (const cmd of c.commands)
            cmd.title = tr(cmd.title);
    if (c.notebookbar) {
        for (const tab of c.notebookbar) {
            tab.tab = tr(tab.tab);
            for (const group of tab.groups || []) {
                group.label = tr(group.label);
                for (const item of group.items || []) {
                    if (item.type === 'menu')
                        item.title = tr(item.title);
                }
            }
        }
    }
}
// Discover and register the JS extensions for this document by fetching three discovery indexes
// (built-in, admin preset, per-user preset), in that order, merging with per-user > admin >
// built-in precedence on ID collision, then loading each surviving manifest.json and registering
// one Control.Extension per entry on `map._extensions` (and manifests with an unsupported
// manifestVersion or that don't apply to the current docType are skipped/ with a console warning
// rather than aborting discovery):
window.L.loadExtensions = async function (map, docType) {
    // Gated on the experimental-features flag so deployments not opting in to
    // experimental functionality never fetch the discovery index:
    if (!window.enableExperimentalFeatures)
        return {};
    // The app builds have no server macro settings.
    if (!window.ThisIsAMobileApp) {
        if (!window.enableMacrosExecution)
            return {};
        // Extensions are not signed, and a level above 1 does not run unsigned macros.
        if (window.macroSecurityLevel > 1)
            return {};
    }
    // The read-only state comes from the server's perm and filemode messages, so it also covers
    // permission=readonly, comment-only sessions and view-only file types:
    if (app.isReadOnly() ||
        (map.wopi &&
            (!map.wopi.UserCanWrite ||
                map.wopi.DisableCopy ||
                map.wopi.DisableExport ||
                map.wopi.DisablePrint))) {
        return {};
    }
    const sources = [];
    const fetchIndex = async (indexBase) => {
        try {
            const resp = await fetch(app.LOUtil.getURL(indexBase + 'index.json'));
            if (!responseSucceeded(resp))
                throw new Error('HTTP ' + resp.status);
            return await resp.json();
        }
        catch (err) {
            console.warn('extension discovery: ' + indexBase + 'index.json unreadable:', err);
            return [];
        }
    };
    const addPresetSource = async (configId) => {
        const presetBase = 'preset/' + encodeURIComponent(configId) + '/extensions/';
        const presetIds = await fetchIndex(presetBase);
        sources.push({ baseRel: presetBase, ids: presetIds });
    };
    const builtinIds = await fetchIndex('extensions/');
    sources.push({ baseRel: 'extensions/', ids: builtinIds });
    if (app.presetConfigId)
        await addPresetSource(app.presetConfigId);
    // Flatten the sources into one list of (id, baseRel) entries; Map.set's last-write-wins
    // behavior causes admin extensions to override built-in
    // ones:
    const byId = new Map();
    for (const src of sources) {
        for (const id of src.ids)
            byId.set(id, src.baseRel);
    }
    // Fetch all the manifests in parallel; the loop afterwards just registers what survived:
    const loaded = await Promise.all(Array.from(byId.entries()).map(async ([id, baseSourceRel]) => {
        const baseRel = baseSourceRel + id + '/';
        try {
            const resp = await fetch(app.LOUtil.getURL(baseRel + 'manifest.json'));
            if (!responseSucceeded(resp))
                throw new Error('HTTP ' + resp.status);
            const manifest = await resp.json();
            // contributes is a string naming a separate JSON file (resolved the same way
            // entry/icon are) holding the actual object, keeping manifest.json itself
            // short and scannable regardless of how much UI an extension wires up.
            // Replace it with the fetched object here, once, so every later reader of
            // manifest.contributes (including the rest of this function) sees only the
            // object form and never has to know it started out as a path.
            if (manifest.contributes) {
                const uiPath = manifest.contributes;
                try {
                    const uiResp = await fetch(app.LOUtil.getURL(baseRel + uiPath));
                    if (!responseSucceeded(uiResp))
                        throw new Error('HTTP ' + uiResp.status);
                    manifest.contributes = await uiResp.json();
                }
                catch (err) {
                    console.warn('extension ' +
                        id +
                        ': contributes file "' +
                        uiPath +
                        '" unreadable:', err);
                    manifest.contributes = undefined;
                }
            }
            if (manifest.contributes && manifest.contributes.commands) {
                await Promise.all(manifest.contributes.commands.map(async (command) => {
                    // Panel commands have no kit-side script to fetch.
                    if (command.panel)
                        return;
                    if (!command.script) {
                        console.warn('extension ' +
                            id +
                            ': command ' +
                            command.id +
                            ' has neither script nor panel');
                        return;
                    }
                    try {
                        const scriptResp = await fetch(app.LOUtil.getURL(baseRel + command.script));
                        if (!responseSucceeded(scriptResp))
                            throw new Error('HTTP ' + scriptResp.status);
                        command.source = await scriptResp.text();
                    }
                    catch (err) {
                        console.warn('extension ' +
                            id +
                            ': command ' +
                            command.id +
                            ' script unreadable:', err);
                    }
                }));
            }
            await localizeManifest(manifest, baseRel);
            return { id, baseRel, manifest };
        }
        catch (err) {
            try {
                const gasManifest = await tryLoadAppsScriptExtension(id, baseRel, map);
                if (gasManifest) {
                    await localizeManifest(gasManifest, baseRel);
                    return { id, baseRel, manifest: gasManifest };
                }
            }
            catch (gasErr) {
                console.warn('extension ' + id + ': failed to load:', gasErr);
                return null;
            }
            console.warn('extension ' + id + ': failed to load:', err);
            return null;
        }
    }));
    const exts = {};
    for (const entry of loaded) {
        if (entry === null)
            continue;
        const { id, baseRel, manifest } = entry;
        if (manifest.manifestVersion !== '0.1') {
            console.warn('extension ' +
                id +
                ': unsupported manifestVersion ' +
                manifest.manifestVersion);
            continue;
        }
        if (manifest.supports &&
            manifest.supports.length > 0 &&
            !manifest.supports.includes(docType)) {
            continue;
        }
        const ext = window.L.control.extension(id, manifest, app.LOUtil.getURL(baseRel));
        map.addControl(ext);
        exts[id] = ext;
    }
    return exts;
};

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
 * Util.ModelState - will hold and update the state of a JSDialog model for a component
 *                   that will allow to be aware of previous updates even if we recreate
 *                   DOM nodes without any server communication (example: notebookbar switch)
 */
class JSDialogModelState {
    constructor(componentName) {
        app.console.debug('JSDialogModelState: created new for component: ' + componentName);
        this.componentName = componentName;
        this.model = null;
    }
    copyObject(obj) {
        // use new API first
        if (window.structuredClone) {
            try {
                return window.structuredClone(obj);
            }
            catch (e) {
                app.console.debug('JSDialogModelState: ' + e);
            }
        }
        // try fallback
        try {
            app.console.debug('JSDialogModelState: fallback copy by JSON.parse');
            return JSON.parse(JSON.stringify(obj));
        }
        catch (e) {
            app.console.debug('JSDialogModelState: failed to clone the model: ' + e);
        }
        try {
            app.console.debug('JSDialogModelState: fallback copy by Object.assign');
            return Object.assign({}, obj);
        }
        catch (e) {
            app.console.debug('JSDialogModelState: ' + e);
        }
        return null;
    }
    safeStringify(obj) {
        try {
            return JSON.stringify(obj);
        }
        catch (e) {
            app.console.debug('JSDialogModelState: ' + e);
        }
        return 'Bad Object';
    }
    /// get model copy
    getSnapshot() {
        if (this.model) {
            const snapshot = this.copyObject(this.model);
            if (snapshot) {
                return snapshot;
            }
            else {
                app.console.debug('JSDialogModelState: cannot copy object, use original model');
                return this.model;
            }
        }
        return null;
    }
    /// replaces complete state of a model
    fullUpdate(data) {
        app.console.debug('JSDialogModelState: set model for component: ' + this.componentName);
        this.model = data;
    }
    /// replaces complete state of a model but keeps the entries widgets received
    /// at runtime (styles view, font name box, ...), those are not part of the
    /// generated layout so a rebuilt model would show such widgets as empty
    fullUpdateKeepingEntries(data) {
        const previousModel = this.model;
        this.fullUpdate(data);
        if (!previousModel)
            return;
        JSDialogModelState.forEachWidget(previousModel, (widget) => {
            const entries = widget.entries;
            if (entries)
                this.widgetUpdate({
                    id: widget.id,
                    entries: entries,
                });
        });
    }
    /// applies widget update to a model
    applyUpdate(data) {
        if (!data || !data.control || !data.control.id) {
            app.console.error('JSDialogModelState: bad syntax in widgetUpdate: ' +
                this.safeStringify(data));
            return;
        }
        this.widgetUpdate(data.control);
    }
    /// applies widget update to a model
    widgetUpdate(widget) {
        const found = this.getById(widget.id);
        if (found) {
            const id = found.id;
            const before = this.safeStringify(found);
            // data will no longer be used, we don't need deep copy
            Object.assign(found, widget);
            if (JSDialog.verbose) {
                app.console.debug('JSDialogModelState: ' +
                    this.componentName +
                    ' widgetUpdate\n\nBEFORE: ' +
                    before +
                    '\n\nAFTER: ' +
                    this.safeStringify(this.getById(id)));
            }
        }
    }
    /// applies action to a model
    widgetAction(data) {
        if (!data || !data.data || !data.data.control_id) {
            app.console.error('JSDialogModelState: bad syntax in widgetAction: ' +
                this.safeStringify(data));
            return;
        }
        const found = this.getById(data.data.control_id);
        if (found) {
            if (JSDialog.verbose) {
                app.console.debug('JSDialogModelState: ' +
                    this.componentName +
                    ' widgetAction ' +
                    data.data.control_id);
            }
            if (data.data.action_type === 'show')
                found.visible = true;
            else if (data.data.action_type === 'hide')
                found.visible = false;
            else if (data.data.action_type === 'rename' && data.data.new_id)
                found.id = data.data.new_id;
            else if (data.data.action_type === 'redraw' && data.data.control)
                this.widgetUpdate(data.data.control);
        }
    }
    /// returns current state of a widget with given id
    getById(widgetId) {
        if (!this.model) {
            app.console.debug('JSDialogModelState: model missing in component: ' + this.componentName);
            return null;
        }
        const found = JSDialogModelState.findWidgetById(widgetId, this.model);
        if (!found && JSDialog.verbose)
            app.console.debug('JSDialogModelState: ' +
                this.componentName +
                ' not found id: ' +
                widgetId);
        return found;
    }
    static forEachWidget(widget, callback) {
        callback(widget);
        if (widget.children)
            for (const child of widget.children)
                JSDialogModelState.forEachWidget(child, callback);
    }
    static findWidgetById(id, model) {
        if (model.id === id) {
            return model;
        }
        else if (model.children) {
            for (const i in model.children) {
                const found = JSDialogModelState.findWidgetById(id, model.children[i]);
                if (found)
                    return found;
            }
        }
        return null;
    }
}

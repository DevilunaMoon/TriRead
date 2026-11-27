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
class EditWidget {
    constructor(parentContainer, data, builder, callback) {
        this.parentContainer = parentContainer;
        this.data = data;
        this.builder = builder;
        this.callback = callback;
    }
    static buildImpl(parentContainer, data, builder) {
        const result = { container: null, input: null };
        var container = window.L.DomUtil.create('div', 'ui-edit-container ' + builder.options.cssClass, parentContainer);
        container.id = data.id;
        result.container = container;
        var edit = window.L.DomUtil.create('input', 'ui-edit ' + builder.options.cssClass, container);
        edit.value = data.text;
        edit.id = data.id + '-input';
        edit.dir = 'auto';
        edit.setAttribute('autocomplete', 'off');
        result.input = edit;
        if (data.password === true)
            edit.type = 'password';
        if (data.enabled === false) {
            container.setAttribute('disabled', 'true');
            edit.disabled = true;
        }
        JSDialog.SynchronizeDisabledState(container, [edit]);
        if (data.hidden)
            $(edit).hide();
        if (data.placeholder) {
            edit.setAttribute('placeholder', data.placeholder);
        }
        // hexpand means the entry should fill the available space, so don't cap
        // it to its preferred character width (which is otherwise defaulted to 20
        // by the desktop builder, leaving expanding entries stuck at ~half width).
        if (data.widthInChars && data.widthInChars > 0 && !data.hexpand) {
            var widthValue = data.widthInChars + 2 + 'ch';
            edit.style.maxWidth = widthValue;
            container.style.width = 'fit-content';
        }
        data.aria = data.aria || {};
        if (!data.aria.label)
            data.aria.label = data.placeholder;
        JSDialog.SetupA11yLabelForLabelableElement(parentContainer, edit, data, builder);
        return result;
    }
    onKeyUp(e) {
        var callbackToUse = e.key === 'Enter' && this.data.changedCallback
            ? this.data.changedCallback
            : null;
        if (this.callback)
            callbackToUse = this.callback;
        if (typeof callbackToUse === 'function')
            callbackToUse(this.edit.input.value);
        else {
            var eventType = 'change';
            if (e.key === 'Enter')
                eventType = 'activate';
            this.builder.callback('edit', eventType, this.edit.container, this.edit.input.value, this.builder);
        }
    }
    onClick(e) {
        e.stopPropagation();
    }
    // leaving the field is told to the engine, where a dialog may take the value then
    onBlur() {
        if (this.callback)
            return;
        this.builder.callback('edit', 'focus_out', this.edit.container, this.edit.input.value, this.builder);
    }
    setupEventListeners() {
        this.edit.input.addEventListener('keyup', this.onKeyUp.bind(this));
        this.edit.input.addEventListener('click', this.onClick.bind(this));
        this.edit.input.addEventListener('blur', this.onBlur.bind(this));
    }
    build() {
        this.edit = EditWidget.buildImpl(this.parentContainer, this.data, this.builder);
        this.setupEventListeners();
        return false;
    }
}
JSDialog.edit = function (parentContainer, data, builder, callback) {
    const widget = new EditWidget(parentContainer, data, builder, callback);
    return widget.build();
};

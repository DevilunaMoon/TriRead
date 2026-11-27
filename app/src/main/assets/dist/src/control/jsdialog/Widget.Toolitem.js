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
function _mapDispatchToolItem(parentContainer, data, builder) {
    if (!data.command)
        data.command = data.id;
    if (data.id && !app.isExportEntryVisible(data.id))
        return false;
    const backupInlineText = builder.options.useInLineLabelsForUnoButtons;
    if (data.inlineLabel !== undefined)
        builder.options.useInLineLabelsForUnoButtons = data.inlineLabel;
    const control = builder._unoToolButton(parentContainer, data, builder);
    if (data.inlineLabel !== undefined)
        builder.options.useInLineLabelsForUnoButtons = backupInlineText;
    $(control.button).unbind('click');
    $(control.label).unbind('click');
    if (!builder.map.isLockedItem(data)) {
        const handlePressAndHold = (data) => {
            const scrollingInterval = setInterval(() => {
                app.dispatcher.dispatch(data.command);
            }, 100);
            $(document).one('mouseup', () => {
                clearInterval(scrollingInterval);
            });
        };
        // Handle "Press+Hold" Event
        if (data.pressAndHold) {
            $(control.container).on('mousedown', (e) => {
                if (e.button !== 0 || // Only handle left mouse button
                    control.container.getAttribute('disabled') !== null)
                    return;
                const pressAndHoldTimer = setTimeout(() => {
                    handlePressAndHold(data);
                }, 500);
                $(document).one('mouseup', () => {
                    clearTimeout(pressAndHoldTimer);
                });
            });
        }
        $(control.container).click(() => {
            if (control.container.getAttribute('disabled') === null)
                app.dispatcher.dispatch(data.command);
        });
    }
    builder._preventDocumentLosingFocusOnClick(control.container);
}
function _mapBigDispatchToolItem(parentContainer, data, builder) {
    if (!data.command)
        data.command = data.id;
    const noLabels = builder.options.noLabelsForUnoButtons;
    builder.options.noLabelsForUnoButtons = false;
    const control = builder._unoToolButton(parentContainer, data, builder);
    builder.options.noLabelsForUnoButtons = noLabels;
    $(control.button).unbind('click');
    $(control.label).unbind('click');
    if (!builder.map.isLockedItem(data)) {
        $(control.container).click((e) => {
            e.preventDefault();
            app.dispatcher.dispatch(data.command);
        });
    }
    builder._preventDocumentLosingFocusOnClick(control.container);
}
JSDialog.dispatchToolitem = function (parentContainer, data, builder) {
    return _mapDispatchToolItem(parentContainer, data, builder);
};
JSDialog.bigDispatchToolitem = function (parentContainer, data, builder) {
    return _mapBigDispatchToolItem(parentContainer, data, builder);
};

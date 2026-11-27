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
const customWidgetHandlers = {};
function registerCustomWidgetHandler(customType, handler) {
    customWidgetHandlers[customType] = handler;
}
function _customWidgetControl(parentContainer, data, builder) {
    const customType = data.customType;
    if (!customType) {
        window.app.console.warn('CustomWidget: missing customType for widget', data.id);
        return false;
    }
    const handler = customWidgetHandlers[customType];
    if (!handler) {
        window.app.console.warn('CustomWidget: no handler registered for customType:', customType);
        return false;
    }
    return handler(parentContainer, data, builder);
}
JSDialog.customWidget = function (parentContainer, data, builder) {
    return _customWidgetControl(parentContainer, data, builder);
};
JSDialog.registerCustomWidgetHandler = registerCustomWidgetHandler;

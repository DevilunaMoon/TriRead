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
function onStateChange(element, callback) {
    const enabledCallback = function (mutations) {
        for (const i in mutations) {
            if (mutations[i].attributeName === 'disabled') {
                const htmlElement = mutations[i].target;
                callback(!htmlElement.hasAttribute('disabled'));
            }
        }
    };
    const enableObserver = new MutationObserver(enabledCallback);
    enableObserver.observe(element, { attributeFilter: ['disabled'], attributeOldValue: true });
}
function moveFocusFromDisabledElement(widget) {
    const dialog = widget.closest('.jsdialog-window');
    if (!dialog)
        return;
    const next = JSDialog.FindFocusableElement(widget.nextElementSibling, 'next');
    if (next) {
        next.focus();
        return;
    }
    const prev = JSDialog.FindFocusableElement(widget.previousElementSibling, 'prev');
    if (prev) {
        prev.focus();
        return;
    }
    const focusable = JSDialog.GetFocusableElements(dialog);
    if (focusable && focusable.length) {
        focusable[0].focus();
    }
}
function synchronizeDisabledState(source, targets) {
    const enabledCallback = function (enable) {
        app.layoutingService.appendLayoutingTask(() => {
            for (const i in targets) {
                if (enable) {
                    targets[i].removeAttribute('disabled');
                    targets[i].removeAttribute('aria-disabled');
                }
                else {
                    const hadFocus = targets[i].contains(document.activeElement);
                    targets[i].setAttribute('disabled', 'true');
                    targets[i].setAttribute('aria-disabled', 'true');
                    if (hadFocus)
                        moveFocusFromDisabledElement(source);
                }
            }
        });
    };
    onStateChange(source, enabledCallback);
}
JSDialog.OnStateChange = onStateChange;
JSDialog.SynchronizeDisabledState = synchronizeDisabledState;

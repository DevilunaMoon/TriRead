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
class SnackbarController {
    constructor() {
        this.snackbarTimeout = 10000;
        this.showingSnackbar = false;
        // The label of the snackbar that shows now, or null when none shows.
        this.shownLabel = null;
        this.liveRegion = null;
        this.fadeOutTimer = null;
        this.snackbarQueue = new Array();
    }
    writeLiveRegion(label) {
        if (!this.liveRegion)
            this.liveRegion = document.getElementById('snackbar-live-region');
        const region = this.liveRegion;
        if (!region)
            return;
        app.layoutingService.appendLayoutingTask(() => {
            region.textContent = label;
        });
    }
    // Sends the close for the snackbar dialog. The dialog removal calls back
    // into onSnackbarRemoved, which is where the queue state is reset.
    removeSnackbar() {
        var closeMessage = {
            id: 'snackbar',
            jsontype: 'dialog',
            type: 'snackbar',
            action: 'close',
        };
        app.socket._onMessage({
            textMsg: 'jsdialog: ' + JSON.stringify(closeMessage),
        });
    }
    // The snackbar dialog is gone from the DOM
    onSnackbarRemoved() {
        app.timerRegistry.clearTimeout(this.fadeOutTimer);
        this.fadeOutTimer = null;
        this.showingSnackbar = false;
        this.shownLabel = null;
        this.writeLiveRegion('');
        this.scheduleSnackbar();
    }
    // Drops the snackbars that wait for the one on screen to close.
    clearQueue() {
        this.snackbarQueue = [];
    }
    closeSnackbar(byUser = false) {
        const snackbar = document.getElementById('snackbar');
        if (byUser || !snackbar) {
            this.removeSnackbar();
            return;
        }
        if (this.fadeOutTimer !== null)
            return;
        let timer = null;
        const onAnimationEnd = (event) => {
            if (event.target === snackbar)
                finishFadeOut();
        };
        const finishFadeOut = () => {
            snackbar.removeEventListener('animationend', onAnimationEnd);
            if (this.fadeOutTimer === timer)
                this.removeSnackbar();
        };
        snackbar.classList.remove('fadein');
        snackbar.classList.add('snackbar-leaving');
        snackbar.addEventListener('animationend', onAnimationEnd);
        timer = this.fadeOutTimer = app.timerRegistry.setTimeout('snackbar-fadeout', finishFadeOut, window.L.DomUtil.getDurationMs('--duration-fast') + 100);
    }
    // A snackbar with the given label shows now, or waits in the queue to show.
    hasSnackbar(label) {
        return ((this.showingSnackbar && this.shownLabel === label) ||
            this.snackbarQueue.some((data) => data.label === label));
    }
    // Close the snackbar with the given label, or take it out of the queue. A snackbar with another
    // label stays.
    closeSnackbarWithLabel(label) {
        this.snackbarQueue = this.snackbarQueue.filter((data) => data.label !== label);
        if (this.showingSnackbar && this.shownLabel === label)
            this.closeSnackbar();
    }
    showSnackbar(label, action, callback, timeout, hasProgress, withDismiss, infinite, focusAction = true) {
        if (!app.socket)
            return;
        this.snackbarQueue.push({
            label: label,
            action: action,
            callback: callback,
            timeout: timeout,
            hasProgress: hasProgress,
            withDismiss: withDismiss,
            infinite: infinite,
            focusAction: focusAction,
        });
        this.scheduleSnackbar();
    }
    extractTimeout(snackbarData) {
        return snackbarData.timeout || this.snackbarTimeout;
    }
    scheduleSnackbar() {
        if (this.showingSnackbar || !this.snackbarQueue.length)
            return;
        const snackbarData = this.snackbarQueue.shift();
        this.showSnackbarImpl(snackbarData);
        this.showingSnackbar = true;
        this.shownLabel = snackbarData.label;
    }
    showSnackbarImpl(snackbarData) {
        var buttonId = 'button';
        var labelId = 'label';
        if (!snackbarData.action)
            this.writeLiveRegion(snackbarData.label);
        const dismissButton = snackbarData.action
            ? {
                id: 'snackbar-dismiss-button',
                type: 'pushbutton',
                text: '',
                icon: 'lc_cancel.svg',
                aria: { label: _('Dismiss') },
            }
            : {
                id: 'snackbar-dismiss-button',
                type: 'pushbutton',
                text: _('Dismiss'),
            };
        var json = {
            id: 'snackbar',
            jsontype: 'dialog',
            type: 'snackbar',
            timeout: this.extractTimeout(snackbarData),
            init_focus_id: snackbarData.action && snackbarData.focusAction ? buttonId : undefined,
            children: [
                {
                    id: snackbarData.hasProgress
                        ? 'snackbar-container-progress'
                        : 'snackbar-container',
                    type: 'container',
                    children: [
                        snackbarData.action
                            ? {
                                id: labelId,
                                type: 'fixedtext',
                                text: snackbarData.label,
                                labelFor: buttonId,
                            }
                            : {
                                id: 'label-no-action',
                                type: 'fixedtext',
                                text: snackbarData.label,
                            },
                        snackbarData.hasProgress
                            ? {
                                id: 'progress',
                                type: 'progressbar',
                                value: 0,
                                maxValue: 100,
                                infinite: snackbarData.infinite,
                            }
                            : {},
                        snackbarData.action
                            ? {
                                id: buttonId,
                                type: 'pushbutton',
                                text: snackbarData.action,
                                labelledBy: labelId,
                            }
                            : {},
                        snackbarData.withDismiss ? dismissButton : {},
                    ],
                },
            ],
        };
        var builderCallback = (objectType, eventType, object, data, builder) => {
            window.app.console.debug("control: '" +
                objectType +
                "' id:'" +
                object.id +
                "' event: '" +
                eventType +
                "' state: '" +
                data +
                "'");
            if (object.id === buttonId &&
                objectType === 'pushbutton' &&
                eventType === 'click') {
                if (typeof snackbarData.callback === 'function')
                    snackbarData.callback();
                this.closeSnackbar(true);
            }
            else if (object.id === '__POPOVER__' &&
                objectType === 'popover' &&
                eventType === 'close') {
                this.closeSnackbar(true);
            }
            if (object.id === 'snackbar-dismiss-button' &&
                objectType === 'pushbutton' &&
                eventType === 'click') {
                this.closeSnackbar(true);
            }
        };
        app.socket._onMessage({
            textMsg: 'jsdialog: ' + JSON.stringify(json),
            callback: builderCallback,
        });
    }
    // value should be in range 0-100
    setSnackbarProgress(value, infinite) {
        if (!app.socket)
            return;
        var json = {
            id: 'snackbar',
            jsontype: 'dialog',
            type: 'snackbar',
            action: 'update',
            control: {
                id: 'progress',
                type: 'progressbar',
                value: value,
                maxValue: 100,
                infinite: infinite,
            },
        };
        app.socket._onMessage({ textMsg: 'jsdialog: ' + JSON.stringify(json) });
    }
}
JSDialog.SnackbarController = new SnackbarController();

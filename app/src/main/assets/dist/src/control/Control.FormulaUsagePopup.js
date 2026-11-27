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
/*
 * Control.FormulaUsagePopup
 */
/* global app */
class FormulaUsagePopup extends AutoCompletePopup {
    constructor(map) {
        super(AutoCompleteDialogId.FormulaUsagePopup, map);
        this.newPopupData = {
            children: [
                {
                    id: 'container',
                    type: 'container',
                    enabled: true,
                    children: new Array(),
                    vertical: true,
                },
            ],
            jsontype: 'dialog',
            type: 'dialog',
            cancellable: true,
            hasClose: false,
            isAutoCompletePopup: true,
            popupParent: undefined,
            clickToClose: undefined,
            id: 'formulausagePopup',
            title: '', // no titlebar
        };
    }
    onAdd() {
        this.newPopupData.isAutoCompletePopup = true;
        this.map.on('openformulausagepopup', this.openFormulaUsagePopup, this);
        this.map.on('sendformulausagetext', this.sendFormulaUsageText, this);
    }
    openFormulaUsagePopup(ev) {
        this.openPopup({ data: ev });
        this.map.focus();
    }
    sendFormulaUsageText(ev) {
        this.openFormulaUsagePopup(ev);
    }
    getPopupEntries(ev) {
        this.usageText = ev.data.data;
        var chIndex = this.usageText.indexOf(':');
        var functionUsage = this.usageText.substring(0, chIndex);
        var usageDescription = this.usageText.substring(chIndex + 1);
        const entries = [
            {
                row: 0,
                columns: [{ text: functionUsage }],
                collapsed: false,
                children: [{ row: 1, columns: [{ text: usageDescription }] }],
            },
        ];
        return entries;
    }
    callback(objectType, eventType, object, index) {
        if (eventType === 'close') {
            this.closePopup();
        }
        return false;
    }
}

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
class AutoCompletePopup {
    constructor(popupId, map) {
        this.map = map;
        this.popupId = popupId;
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
            type: 'modalpopup',
            cancellable: true,
            popupParent: '_POPOVER_',
            clickToClose: '_POPOVER_',
            id: this.popupId,
            persistKeyboard: true,
        };
        this.isSmallScreenDevice = window.mode.isSmallScreenDevice();
        this.onAdd();
        this.map.on('closepopup', this.closePopup, this);
    }
    closePopup() {
        var popupExists = window.L.DomUtil.get(this.popupId);
        if (!popupExists)
            return;
        this.map.jsdialog.focusToLastElement(this.popupId);
        this.map.jsdialog.clearDialog(this.popupId);
    }
    getPopupJSON(control, framePos) {
        return {
            jsontype: 'dialog',
            id: this.popupId,
            action: 'update',
            control: control,
            posx: framePos.x,
            posy: framePos.y,
            children: undefined,
        };
    }
    getTreeJSON() {
        return {
            id: this.popupId + 'List',
            type: 'treelistbox',
            text: '',
            enabled: true,
            singleclickactivate: false,
            fireKeyEvents: true,
            entries: [],
            noSearchField: true,
        };
    }
    sendUpdate(data) {
        this.map.fire('jsdialogupdate', {
            data: data,
            callback: this.callback.bind(this),
        });
    }
    sendJSON(data) {
        const fireEvent = this.isSmallScreenDevice ? 'mobilewizard' : 'jsdialog';
        this.map.fire(fireEvent, {
            data: data,
            callback: this.callback.bind(this),
        });
    }
    getCursorPosition() {
        const commentSection = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name);
        if (commentSection?.getActiveEdit()) {
            const caretRect = window
                .getSelection()
                .getRangeAt(0)
                .getBoundingClientRect();
            return new cool.Point(caretRect.left, caretRect.bottom);
        }
        // Cursor position relative to the top-left of the viewed area, in CSS
        // pixels. This used the leaflet map pane (pixelOrigin - mapPanePos),
        // which equals the viewed rectangle's top-left; read it from the layout
        // so it stays correct without moving the map pane.
        const cursorRect = app.file.textCursor.rectangle;
        const viewed = app.activeDocument.activeLayout.viewedRectangle;
        return new cool.Point(Math.round(cursorRect.cX1 - viewed.cX1), Math.round(cursorRect.cY2 - viewed.cY1));
    }
    openPopup(ev) {
        const entries = this.getPopupEntries(ev);
        if (entries.length === 0)
            return;
        const cursorPos = this.getCursorPosition();
        const control = this.getTreeJSON();
        if (this.newPopupData.serverSyncSelection !== undefined) {
            control.serverSyncSelection = this.newPopupData.serverSyncSelection;
        }
        if (window.L.DomUtil.get(this.popupId + 'List')) {
            const data = this.getPopupJSON(control, cursorPos);
            data.control.entries = entries;
            this.sendUpdate(data);
            return;
        }
        if (window.L.DomUtil.get(this.popupId))
            this.closePopup();
        const data = this.newPopupData;
        data.children[0].children[0] = control;
        data.children[0].children[0].entries = entries;
        const isSpreadsheetRTL = this.map._docLayer.isCalcRTL();
        const canvasEl = this.map._docLayer._canvas.getBoundingClientRect();
        const offsetX = isSpreadsheetRTL
            ? 0
            : app.sectionContainer.getSectionWithName(app.CSections.RowHeader.name)
                .size[0];
        const offsetY = app.sectionContainer.getSectionWithName(app.CSections.ColumnHeader.name).size[1];
        if (isSpreadsheetRTL)
            cursorPos.x = app.activeDocument.activeLayout.frameSize.cX - cursorPos.x;
        data.posx = cursorPos.x + offsetX + canvasEl.left;
        data.posy = cursorPos.y + offsetY + canvasEl.top;
        this.sendJSON(data);
    }
    getPopupId() {
        return this.popupId;
    }
    callback(objectType, eventType, object, index) {
        if (eventType === 'keydown') {
            if (object.key !== 'Tab' && object.key !== 'Shift') {
                this.map.focus();
                return true;
            }
        }
        return false;
    }
}

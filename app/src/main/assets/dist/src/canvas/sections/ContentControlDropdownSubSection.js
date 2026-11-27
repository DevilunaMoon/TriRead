// @ts-strict-ignore
/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class ContentControlDropdownSubSection extends HTMLObjectSection {
    constructor(sectionName, documentPosition, visible = true, dropdownMarkerWidth, dropdownMarkerHeight) {
        super(sectionName, dropdownMarkerWidth, dropdownMarkerHeight, documentPosition, 'writer-drop-down-marker', visible);
    }
    callback(objectType, eventType, object, data, builder) {
        var fireEvent = 'jsdialog';
        if (window.mode.isSmallScreenDevice()) {
            fireEvent = 'mobilewizard';
        }
        var closeDropdownJson = {
            jsontype: 'dialog',
            type: 'modalpopup',
            action: 'close',
            id: builder.windowId,
        };
        if (eventType === 'close') {
            app.map.fire(fireEvent, { data: closeDropdownJson, callback: undefined });
        }
        else if (eventType === 'activate') {
            // a click, Enter or Space; an arrow key only moves through the list
            app.socket.sendMessage('contentcontrolevent type=drop-down selected=' + data);
            app.map.fire(fireEvent, { data: closeDropdownJson, callback: undefined });
        }
    }
    showDatePicker() {
        if ($('#datepicker').is(':visible')) {
            this.sectionProperties.parent.leaveDatePicker();
            $('#datepicker').hide();
        }
        else {
            var datePicker = document.getElementById('datepicker');
            datePicker.style.left = String(this.myTopLeft[0] / app.dpiScale) + 'px';
            datePicker.style.top =
                String((this.myTopLeft[1] + this.size[1]) / app.dpiScale) + 'px';
            // back on the chosen date, from a month that Prev or Next turned to
            $('#datepicker').datepicker('setDate', $('#datepicker').datepicker('getDate'));
            $('#datepicker').show();
            this.sectionProperties.parent.focusDatePicker();
        }
    }
    getDropdownJson() {
        if (!this.sectionProperties.json.items)
            return;
        const json = {
            children: [
                {
                    id: 'container-dropdown',
                    type: 'container',
                    text: '',
                    enabled: true,
                    children: [
                        {
                            id: 'contentControlList',
                            type: 'treelistbox',
                            text: '',
                            enabled: true,
                            singleclickactivate: true,
                        },
                    ],
                    vertical: true,
                },
            ],
            jsontype: 'dialog',
            type: 'modalpopup',
            cancellable: true,
            popupParent: '_POPOVER_',
            clickToClose: '_POPOVER_',
            id: 'contentControlModalpopup',
            isPopupPartialScreen: true,
        };
        const entries = [];
        const items = this.sectionProperties.json.items;
        //add entries
        for (var i in items) {
            var entry = {
                text: items[i],
                columns: [
                    {
                        text: items[i],
                    },
                ],
                row: i.toString(),
            };
            entries.push(entry);
        }
        json.children[0].children[0].entries = entries;
        //add position
        json.posx =
            (this.myTopLeft[0] - this.sectionProperties.parent.size[0]) /
                app.dpiScale;
        json.posy = (this.myTopLeft[1] + this.size[1]) / app.dpiScale;
        return json;
    }
    containsPoint(point) {
        if (this.position[0] <= point[0] &&
            this.position[0] + this.size[0] >= point[0]) {
            if (this.position[1] <= point[1] &&
                this.position[1] + this.size[1] >= point[1])
                return true;
        }
        return false;
    }
    onClick(point, e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.stopPropagating();
        this.openPopup();
    }
    openPopup() {
        if (this.sectionProperties.datePicker) {
            this.showDatePicker();
        }
        else if (this.sectionProperties.json.items) {
            var fireEvent = 'jsdialog';
            if (window.mode.isSmallScreenDevice()) {
                fireEvent = 'mobilewizard';
            }
            app.map.fire(fireEvent, {
                data: this.getDropdownJson(),
                callback: this.callback,
            });
        }
    }
}
app.definitions.contentControlDropdownSubSection =
    ContentControlDropdownSubSection;

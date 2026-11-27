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
var cool;
(function (cool) {
    class ContentControlSection extends CanvasSectionObject {
        constructor() {
            super(app.CSections.ContentControl.name);
            this.processingOrder = app.CSections.ContentControl.processingOrder;
            this.drawingOrder = app.CSections.ContentControl.drawingOrder;
            this.zIndex = app.CSections.ContentControl.zIndex;
            this.interactable = false;
            this.documentObject = true;
            this.map = window.L.Map.THIS;
            this.sectionProperties.json = null;
            this.sectionProperties.datePicker = false;
            this.sectionProperties.picturePicker = null;
            this.sectionProperties.polygon = null;
            this.sectionProperties.dropdownSection = null;
            this.sectionProperties.dropdownMarkerWidth = 22;
            this.sectionProperties.dropdownMarkerHeight = 22;
        }
        onInitialize() {
            this.map.on('darkmodechanged', this.changeBorderStyle, this);
            var container = window.L.DomUtil.createWithId('div', 'datepicker');
            container.style.zIndex = '12';
            container.style.position = 'absolute';
            container.setAttribute('role', 'dialog');
            container.setAttribute('aria-label', _('Choose a date'));
            container.addEventListener('keydown', this.onDatePickerKeyDown.bind(this));
            document.getElementById('document-container').appendChild(container);
            this.sectionProperties.picturePicker = false;
        }
        setDatePickerVisibility(visible) {
            this.sectionProperties.datePicker = visible;
            if (this.sectionProperties.dropdownSection)
                this.sectionProperties.dropdownSection.sectionProperties.datePicker = visible;
        }
        // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
        drawContentControl(json) {
            // Alt+Down, for the control shown already
            if (json.action === 'popup') {
                if (this.sectionProperties.dropdownSection)
                    this.sectionProperties.dropdownSection.openPopup();
                return;
            }
            // Alt+Down is followed by the same control again, which keeps its open calendar
            if (json.date && $('#datepicker').is(':visible')
                && JSON.stringify(json) === JSON.stringify(this.sectionProperties.json))
                return;
            this.leaveDatePicker();
            this.removeDropdownSection();
            this.sectionProperties.json = json;
            this.setDatePickerVisibility(false);
            this.sectionProperties.picturePicker = false;
            if (json.date) {
                $.datepicker.setDefaults($.datepicker.regional[window.langParamLocale.language]);
                // a calendar made already would keep its first date
                $('#datepicker').datepicker('destroy');
                // onUpdateDatepicker is newer than the typings of jQuery UI
                $('#datepicker').datepicker({
                    defaultDate: this.getCurrentDate(json),
                    dateFormat: 'yy-mm-dd',
                    // after every redraw, e.g. a click on Prev or Next too, which empties the focused day
                    onUpdateDatepicker: () => {
                        if (this.sectionProperties.turningDatePicker)
                            return; // moveDatePicker() labels the last month only
                        const day = this.labelDatePicker();
                        if (day && document.activeElement === document.body
                            && $('#datepicker').is(':visible'))
                            day.focus({ preventScroll: true });
                    },
                    onSelect: (date) => {
                        if (date != '') {
                            app.socket.sendMessage('contentcontrolevent type=date selected=' + date);
                        }
                        this.leaveDatePicker();
                        $('#datepicker').hide();
                    }
                });
                $('#datepicker').hide();
            }
            else
                $('#datepicker').datepicker('destroy');
            if (json.action === 'show')
                this.preparePolygon();
            else if (json.action === 'hide')
                this.sectionProperties.polygon = null;
            else if (json.action === 'change-picture') {
                this.sectionProperties.picturePicker = true;
                if (!this.map.wopi.EnableInsertRemoteImage)
                    app.LOUtil.openFilePicker('insertgraphic');
                else
                    this.map.fire('postMessage', { msgId: 'UI_InsertGraphic' });
            }
            this.setPositionAndSize();
            if (this.sectionProperties.json.items || json.date) {
                this.addDropDownSection();
                if (json.date)
                    this.setDatePickerVisibility(true);
            }
            app.sectionContainer.requestReDraw();
        }
        // the date of the control, as "YYYY-MM-DDT00:00:00Z", or none for today
        getCurrentDate(json) {
            const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(json.currentDate || '');
            if (!match)
                return null;
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        // a grid, as a screen reader passes the keys to one, of days named by their full date, as a
        // number alone means little; returns the day to focus
        labelDatePicker() {
            const picker = document.getElementById('datepicker');
            const table = picker.querySelector('table.ui-datepicker-calendar');
            if (!table)
                return null;
            table.setAttribute('role', 'grid');
            const title = picker.querySelector('.ui-datepicker-title');
            if (title)
                table.setAttribute('aria-label', title.textContent);
            const locale = window.langParam || undefined;
            const cells = [];
            picker.querySelectorAll('td[data-handler="selectDay"]').forEach((cell) => {
                const day = cell.querySelector('a');
                if (!day)
                    return;
                const date = new Date(parseInt(cell.dataset.year), parseInt(cell.dataset.month), parseInt(day.textContent));
                cell.setAttribute('aria-label', date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
                cell.setAttribute('aria-selected', String(day.classList.contains('ui-state-active')));
                cell.tabIndex = -1;
                day.tabIndex = -1; // the cell takes the focus
                cells.push(cell);
            });
            const current = cells.find((cell) => cell.querySelector('a.ui-state-active'))
                || cells.find((cell) => cell.querySelector('a.ui-state-highlight')) || cells[0] || null;
            if (current)
                current.tabIndex = 0;
            return current;
        }
        focusDatePicker() {
            const day = this.labelDatePicker();
            if (day)
                day.focus({ preventScroll: true });
        }
        // before the calendar is hidden or emptied, which would leave the focus nowhere
        leaveDatePicker() {
            if (document.getElementById('datepicker').contains(document.activeElement))
                app.map.focus();
        }
        onDatePickerKeyDown(e) {
            // an Alt chord is the application's, e.g. a repeated Alt+Down
            if (e.altKey)
                return;
            const picker = $('#datepicker');
            // the focused day, which Prev or Next moves away from the selected date
            const day = document.activeElement;
            const cell = day instanceof HTMLElement
                ? day.closest('td[data-handler="selectDay"]') : null;
            const date = cell
                ? new Date(parseInt(cell.dataset.year), parseInt(cell.dataset.month), parseInt(cell.textContent))
                : picker.datepicker('getDate') || new Date();
            const year = date.getFullYear();
            const month = date.getMonth();
            // a calendar for a right-to-left language runs from the right
            const left = picker.datepicker('option', 'isRTL') ? 1 : -1;
            let next = null;
            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'ArrowUp':
                case 'ArrowDown': {
                    const days = { ArrowLeft: left, ArrowRight: -left, ArrowUp: -7, ArrowDown: 7 }[e.key];
                    next = new Date(year, month, date.getDate() + days);
                    break;
                }
                case 'PageUp':
                case 'PageDown': {
                    // a month, or a year with Shift
                    const months = e.shiftKey ? 12 : 1;
                    const target = month + (e.key === 'PageUp' ? -months : months);
                    // the 31st is the 30th or less in a shorter month
                    const last = new Date(year, target + 1, 0).getDate();
                    next = new Date(year, target, Math.min(date.getDate(), last));
                    break;
                }
                case 'Home':
                    next = new Date(year, month, 1);
                    break;
                case 'End':
                    next = new Date(year, month + 1, 0);
                    break;
                case 'Enter':
                case ' ':
                    if (cell)
                        day.click();
                    break;
                case 'Escape':
                case 'Tab': // nothing else in the calendar takes the focus
                    this.leaveDatePicker();
                    picker.hide();
                    break;
                default:
                    return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (next)
                this.moveDatePicker(next);
        }
        // to a day, turning the months as Prev and Next do, which keep the mark of the chosen date
        moveDatePicker(date) {
            const picker = document.getElementById('datepicker');
            const shown = picker.querySelector('td[data-handler="selectDay"]');
            if (!shown)
                return;
            let months = (date.getFullYear() - parseInt(shown.dataset.year)) * 12
                + date.getMonth() - parseInt(shown.dataset.month);
            if (months !== 0) {
                this.sectionProperties.turningDatePicker = true;
                try {
                    for (; months !== 0; months += months < 0 ? 1 : -1) {
                        const turn = picker.querySelector(months < 0
                            ? '[data-handler="prev"]' : '[data-handler="next"]');
                        if (!turn)
                            break;
                        turn.click();
                    }
                }
                finally {
                    this.sectionProperties.turningDatePicker = false;
                }
                this.labelDatePicker();
            }
            const cells = Array.from(picker.querySelectorAll('td[data-handler="selectDay"]'));
            const cell = cells.find((cell) => parseInt(cell.dataset.year) === date.getFullYear()
                && parseInt(cell.dataset.month) === date.getMonth()
                && parseInt(cell.textContent) === date.getDate());
            if (!cell) {
                this.focusDatePicker(); // the focused day may be gone with its month
                return;
            }
            cells.forEach((other) => { other.tabIndex = -1; });
            cell.tabIndex = 0;
            cell.focus({ preventScroll: true });
        }
        setPositionAndSize() {
            if (!this.sectionProperties.json || !this.sectionProperties.json.rectangles)
                return;
            var rectangles = this.getRectangles(this.sectionProperties.json.rectangles);
            this.setPositionAndSizeFromTwipRectangles(rectangles);
        }
        onResize() {
            this.setPositionAndSize();
        }
        preparePolygon() {
            if (!this.sectionProperties.json.rectangles)
                return;
            // Parse rectangles first.
            const rectangleArray = this.getRectangles(this.sectionProperties.json.rectangles);
            this.sectionProperties.polygon = cool.rectanglesToPolygon(rectangleArray, app.twipsToPixels);
            this.changeBorderStyle();
        }
        onDraw() {
            if (!this.sectionProperties.json)
                return;
            if (this.sectionProperties.polygon)
                this.drawPolygon();
            var text = this.sectionProperties.json.alias;
            if (text) {
                var rectangles = this.getRectangles(this.sectionProperties.json.rectangles);
                var x = rectangles[rectangles.length - 1][0] * app.twipsToPixels;
                var y = rectangles[rectangles.length - 1][1] * app.twipsToPixels;
                // fixed height for alias tag
                var h = 20;
                var startX = x - this.position[0] + 5;
                var startY = y - this.position[1];
                var padding = 10;
                var fontStyle = getComputedStyle(document.body).getPropertyValue('--cool-font').split(',')[0].replace(/'/g, '');
                var fontSize = getComputedStyle(document.body).getPropertyValue('--default-font-size');
                var font = fontSize + ' ' + fontStyle;
                var textWidth = app.util.getTextWidth(text, font) + padding;
                // draw rectangle with backgroundcolor
                this.context.beginPath();
                this.context.fillStyle = '#E6FFFF';
                this.context.font = font;
                this.context.fillRect(startX, startY - h, textWidth, h);
                // add text to the rectangle
                this.context.textAlign = 'center';
                this.context.textBaseline = 'middle';
                this.context.fillStyle = '#026296';
                this.context.fillText(text, startX + textWidth / 2, startY - h / 2);
                // draw borders around the rectangle
                this.context.strokeStyle = '#026296';
                this.context.lineWidth = app.dpiScale;
                this.context.strokeRect(startX - 0.5, startY - h - 0.5, textWidth, h);
            }
        }
        onNewDocumentTopLeft() {
            this.setPositionAndSize();
        }
        removeDropdownSection() {
            if (this.sectionProperties.dropdownSection)
                app.sectionContainer.removeSection(this.sectionProperties.dropdownSection.name);
            this.sectionProperties.dropdownSection = null;
        }
        addDropDownSection() {
            this.sectionProperties.dropdownSection = new ContentControlDropdownSubSection('dropdown' + String(Math.random()), new cool.SimplePoint((this.position[0] + this.size[0]) * app.pixelsToTwips, (this.position[1]) * app.pixelsToTwips), true, this.sectionProperties.dropdownMarkerWidth, this.sectionProperties.dropdownMarkerHeight);
            this.sectionProperties.dropdownSection.size[0] = this.sectionProperties.dropdownMarkerWidth * app.dpiScale;
            this.sectionProperties.dropdownSection.size[1] = this.size[1];
            this.sectionProperties.dropdownSection.sectionProperties.json = this.sectionProperties.json;
            this.sectionProperties.dropdownSection.sectionProperties.parent = this;
            app.sectionContainer.addSection(this.sectionProperties.dropdownSection);
            this.sectionProperties.dropdownSection.adjustHTMLObjectPosition();
            this.sectionProperties.dropdownSection.setShowSection(true);
        }
        getRectangles(rect) {
            var rectangles = [];
            //convert string to number coordinates
            var matches = rect.match(/\d+/g);
            if (matches !== null) {
                for (var i = 0; i < matches.length; i += 4) {
                    rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
                }
            }
            return rectangles;
        }
    }
    cool.ContentControlSection = ContentControlSection;
})(cool || (cool = {}));
app.definitions.ContentControlSection = cool.ContentControlSection;

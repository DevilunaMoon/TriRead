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
const LAST_CUSTOM_PREF = 'lineWidthLastCustom';
const HMM_PER_POINT = 2540 / 72;
const PREVIEW_PX_PER_POINT = 2.4;
const PREVIEW_MAX_PX = 20;
function pointsToHMM(points) {
    return Math.round(points * HMM_PER_POINT);
}
function hmmToPoints(hmm) {
    return Math.round((hmm / HMM_PER_POINT) * 10) / 10;
}
function formatPoints(points) {
    return points.toFixed(1) + ' pt';
}
function getLastCustomWidth() {
    const points = parseFloat(window.prefs.get(LAST_CUSTOM_PREF, ''));
    return isNaN(points) || points <= 0 ? null : points;
}
function getCurrentLineWidth(builder) {
    const state = builder.map.stateChangeHandler.getItemValue('.uno:LineWidth');
    const hmm = parseInt(state, 10);
    return isNaN(hmm) || hmm < 0 ? null : hmmToPoints(hmm);
}
function applyLineWidth(builder, points) {
    const hmm = pointsToHMM(points);
    builder.map.sendUnoCommand('.uno:LineWidth?LineWidth:long=' + hmm);
    return hmm;
}
function setWidthPreview(entry, points) {
    const height = Math.min(PREVIEW_MAX_PX, Math.max(1, Math.round(points * PREVIEW_PX_PER_POINT)));
    entry.style.setProperty('--ui-linewidth-preview-height', height + 'px');
}
function createLastCustomEntry(parentContainer, data, builder, applyWidth) {
    const lastCustom = getLastCustomWidth();
    const name = _('Last Custom Value');
    const entry = window.L.DomUtil.create('div', 'ui-combobox-entry ui-linewidth-lastcustom ' + builder.options.cssClass, parentContainer);
    entry.id = data.id + '-lastcustom';
    entry.setAttribute('role', 'option');
    entry.setAttribute('tabindex', '-1');
    entry.setAttribute('aria-selected', 'false');
    if (lastCustom !== null)
        setWidthPreview(entry, lastCustom);
    const text = window.L.DomUtil.create('span', '', entry);
    text.innerText = lastCustom !== null ? formatPoints(lastCustom) : name;
    if (lastCustom === null) {
        window.L.DomUtil.addClass(entry, 'disabled');
        entry.setAttribute('disabled', '');
        entry.setAttribute('aria-disabled', 'true');
    }
    else {
        entry.setAttribute('aria-label', name + ': ' + formatPoints(lastCustom));
    }
    const activate = function () {
        if (lastCustom === null)
            return;
        applyWidth(lastCustom);
        JSDialog.CloseAllDropdowns();
    };
    entry.addEventListener('click', activate);
    entry.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            activate();
            event.preventDefault();
        }
        else if (event.key === 'Tab') {
            JSDialog.CloseAllDropdowns();
            event.preventDefault();
        }
    });
}
JSDialog.LineWidthCustom = function (parentContainer, data, builder) {
    const applyWidth = function (points) {
        applyLineWidth(builder, points);
    };
    window.L.DomUtil.create('hr', 'jsdialog ui-separator horizontal ui-linewidth-section-separator', parentContainer);
    createLastCustomEntry(parentContainer, data, builder, applyWidth);
    return false;
};
JSDialog.LineWidthField = function (parentContainer, data, builder) {
    const current = getCurrentLineWidth(builder);
    data.text = current !== null ? formatPoints(current) : '';
    let sent = null;
    JSDialog.spinfieldControl(parentContainer, data, builder, function (objectType, eventType, object, value) {
        const points = parseFloat(value);
        if (isNaN(points) || points < 0)
            return;
        if (points > 0)
            window.prefs.set(LAST_CUSTOM_PREF, points);
        const hmm = applyLineWidth(builder, points);
        if (sent)
            sent(hmm);
    });
    const container = parentContainer.querySelector('#' + data.id);
    const spinfield = container
        ? container.querySelector('input')
        : null;
    if (!spinfield)
        return false;
    sent = JSDialog.followCommandState(builder, container, '.uno:LineWidth', function (state) {
        const hmm = parseInt(state, 10);
        if (isNaN(hmm) || hmm < 0)
            return;
        const points = hmmToPoints(hmm);
        JSDialog._setSpinFieldValue(spinfield, JSDialog._formatSpinFieldValue(points.toFixed(1), container._unit), points);
    });
    return false;
};

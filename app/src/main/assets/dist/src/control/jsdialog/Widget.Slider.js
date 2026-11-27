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
JSDialog.slider = function (parentContainer, data, builder) {
    const slider = window.L.DomUtil.create('input', builder.options.cssClass + ' ui-slider', parentContainer);
    slider.type = 'range';
    slider.id = data.id;
    slider.min = String(data.min ?? 0);
    slider.max = String(data.max ?? 100);
    slider.step = String(data.step ?? 1);
    slider.value = String(data.value ?? 0);
    JSDialog.SetupA11yLabelForLabelableElement(parentContainer, slider, data, builder);
    if (data.enabled === false)
        slider.disabled = true;
    // The change event comes once the thumb is released, so the core gets the
    // value that the user settled on.
    slider.addEventListener('change', () => {
        if (slider.disabled)
            return;
        builder.callback('slider', 'change', slider, slider.value, builder);
    });
    return false;
};

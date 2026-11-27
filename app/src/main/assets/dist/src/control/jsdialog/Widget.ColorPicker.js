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
// Matches the order of model::ThemeColorType in engine/include/docmodel/theme/ThemeColorType.hxx.
const themeColorTypeNames = [
    _('Dark 1'),
    _('Light 1'),
    _('Dark 2'),
    _('Light 2'),
    _('Accent 1'),
    _('Accent 2'),
    _('Accent 3'),
    _('Accent 4'),
    _('Accent 5'),
    _('Accent 6'),
    _('Hyperlink'),
    _('Followed Hyperlink'),
];
function getThemeColorTooltip(item) {
    const themeName = themeColorTypeNames[item.Data.ThemeIndex];
    if (!themeName)
        return item.Name;
    const percentage = item.Percentage;
    if (percentage > 0)
        return _('%1, %2% Lighter')
            .replace('%1', themeName)
            .replace('%2', String(percentage));
    if (percentage < 0)
        return _('%1, %2% Darker')
            .replace('%1', themeName)
            .replace('%2', String(-percentage));
    return themeName;
}
function findColorName(hexCode) {
    const color = window.app.colorNames.find((c) => c.hexCode.toLowerCase() === hexCode.toLowerCase());
    return color ? color.name : _('Unknown color');
}
function getCurrentPaletteName() {
    const palette = window.prefs.get('colorPalette');
    if (palette === undefined ||
        window.app.colorPalettes[palette] === undefined) {
        return 'StandardColors';
    }
    return palette;
}
// TODO: we don't need to use that format now - simplify?
function toW2Palette(corePalette) {
    const pal = [];
    if (!corePalette)
        return pal;
    for (let i = 0; i < corePalette.length; i++) {
        const row = [];
        for (let j = 0; j < corePalette[i].length; j++) {
            row.push(String(corePalette[i][j].Value).toUpperCase());
        }
        pal.push(row);
    }
    return pal;
}
function sanitizePaletteRow(row) {
    if (row !== undefined) {
        try {
            const json = JSON.parse(row);
            return json.filter((color) => color !== null);
        }
        catch (e) {
            console.error('Cannot parse palette row from cache: "' + row + '" :' + e);
        }
    }
    return null;
}
function generatePalette(paletteName) {
    const colorPalette = toW2Palette(window.app.colorPalettes[paletteName].colors);
    const customColorRow = sanitizePaletteRow(window.prefs.get('customColor'));
    const recentRow = sanitizePaletteRow(window.prefs.get('recentColor'));
    if (customColorRow)
        colorPalette.push(customColorRow);
    else
        colorPalette.push(['F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2', 'F2F2F2']); // custom colors (up to 4)
    if (recentRow) {
        colorPalette.push(recentRow);
    }
    else {
        colorPalette.push([
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
            'F2F2F2',
        ]); // recent colors (up to 8)
    }
    return colorPalette;
}
function createColor(parentContainer, builder, colorItem, index, themeData, widgetData, isCurrent, themeColors, groupName) {
    const color = window.L.DomUtil.create('input', builder.options.cssClass + ' ui-color-picker-entry', parentContainer);
    color.type = 'radio';
    color.name = groupName;
    color.value = colorItem;
    color.style.backgroundColor = '#' + colorItem;
    color.setAttribute('index', index);
    color.checked = isCurrent;
    if (themeData)
        color.setAttribute('theme', themeData);
    // Set color tooltips
    var colorTooltip;
    if (themeData) {
        const found = themeColors.find((item) => item.Value.toLowerCase() === colorItem.toLowerCase());
        if (found)
            colorTooltip = getThemeColorTooltip(found);
    }
    if (!colorTooltip && window.app.colorNames)
        colorTooltip = findColorName(colorItem);
    if (!colorTooltip)
        colorTooltip = _('Unknown color');
    if (window.enableAccessibility) {
        color.setAttribute('aria-label', colorTooltip);
    }
    else {
        color.setAttribute('data-cooltip', colorTooltip);
    }
    // Assuming 'color' is your target HTMLElement
    color.addEventListener('click', (event) => {
        handleColorSelection(event.target, // The clicked element
        builder, // Pass the builder object
        widgetData);
    });
    color.addEventListener('keydown', (event) => {
        if (event.code === 'Enter') {
            event.preventDefault();
            handleColorSelection(event.target, // The clicked element
            builder, // Pass the builder object
            widgetData);
        }
    });
    window.L.control.attachTooltipEventListener(color, builder.map);
    return color;
}
function handleColorSelection(target, builder, widgetData) {
    const palette = generatePalette(getCurrentPaletteName());
    const colorCode = target.getAttribute('value');
    const themeData = target.getAttribute('theme');
    if (colorCode != null) {
        JSDialog.sendColorCommand(builder, widgetData, colorCode, themeData);
        builder.callback('colorpicker', 'hidedropdown', widgetData, themeData ? themeData : colorCode, builder);
    }
    else {
        JSDialog.sendColorCommand(builder, widgetData, 'transparent');
        builder.callback('colorpicker', 'hidedropdown', widgetData, 'transparent', builder);
    }
    // Update the recent colors list
    const recentRow = palette[palette.length - 1];
    if (recentRow.indexOf(colorCode) !== -1)
        recentRow.splice(recentRow.indexOf(colorCode), 1);
    recentRow.unshift(colorCode);
    window.prefs.set('recentColor', JSON.stringify(recentRow));
}
function createAutoColorButton(parentContainer, data, builder) {
    const label = window.L.DomUtil.create('label', '', parentContainer);
    label.textContent = _('Color') + ':';
    label.htmlFor = 'transparent-color-button';
    const hasTransparent = data.command !== '.uno:FontColor' &&
        data.command !== '.uno:Color' &&
        data.command !== '.uno:Extrusion3DColor';
    const buttonText = hasTransparent ? _('No fill') : _('Automatic');
    const autoButton = window.L.DomUtil.create('button', builder.options.cssClass + ' ui-pushbutton auto-color-button', parentContainer);
    autoButton.id = 'transparent-color-button';
    autoButton.innerText = buttonText;
    autoButton.tabIndex = '0';
    autoButton.focus();
    autoButton.addEventListener('click', () => {
        JSDialog.sendColorCommand(builder, data, 'transparent');
        builder.callback('colorpicker', 'hidedropdown', data, '-1', builder);
    });
}
function createPaletteSwitch(parentContainer, builder) {
    const label = window.L.DomUtil.create('label', '', parentContainer);
    label.textContent = _('Palette') + ':';
    label.htmlFor = 'color-palette-listbox';
    const paletteListbox = window.L.DomUtil.create('div', builder.options.cssClass + ' ui-listbox-container color-palette-selector', parentContainer);
    const listbox = window.L.DomUtil.create('select', builder.options.cssClass + ' ui-listbox', paletteListbox);
    listbox.id = 'color-palette-listbox';
    listbox.setAttribute('aria-label', _('Color palette'));
    listbox.setAttribute('tabindex', '0');
    for (const i in window.app.colorPalettes) {
        const paletteOption = window.L.DomUtil.create('option', '', listbox);
        if (i === getCurrentPaletteName())
            paletteOption.setAttribute('selected', 'selected');
        paletteOption.value = i;
        paletteOption.innerText = window.app.colorPalettes[i].name;
    }
    window.L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', paletteListbox);
    return listbox;
}
function updatePalette(paletteName, data, builder, paletteContainer, customContainer, recentContainer) {
    const hexColor = String(JSDialog.getCurrentColor(data, builder));
    const currentColor = hexColor.toUpperCase().replace('#', '');
    const palette = generatePalette(paletteName);
    const detailedPalette = window.app.colorPalettes[paletteName].colors;
    const themeColors = window.app.colorPalettes['ThemeColors'].colors.flat();
    paletteContainer.style.gridTemplateRows =
        'repeat(' + (palette.length - 2) + ', auto)';
    paletteContainer.style.gridTemplateColumns =
        'repeat(' + palette[0].length + ', auto)';
    paletteContainer.replaceChildren();
    for (let i = 0; i < palette.length - 2; i++) {
        for (let j = 0; j < palette[i].length; j++) {
            const themeData = detailedPalette[i][j].Data
                ? JSON.stringify(detailedPalette[i][j].Data)
                : undefined;
            createColor(paletteContainer, builder, palette[i][j], i + ':' + j, themeData, data, currentColor == palette[i][j], themeColors, 'palette-color');
        }
    }
    customContainer.replaceChildren();
    const customLabel = window.L.DomUtil.create('label', '', customContainer);
    customLabel.id = 'ui-color-picker-custom-label';
    customLabel.textContent = _('Custom') + ':';
    customLabel.htmlFor = 'ui-color-picker-custom-input';
    const customInput = window.L.DomUtil.create('input', 'jsdialog ui-edit', customContainer);
    customInput.id = 'ui-color-picker-custom-input';
    customInput.placeholder = '#FFF000';
    customInput.maxlength = 7;
    customInput.type = 'text';
    customInput.addEventListener('change', () => {
        let color = customInput.value;
        if (color.indexOf('#') === 0)
            color = color.substr(1);
        if (color.length != 6) {
            customInput.value = '';
            return;
        }
        const customColorRow = palette[palette.length - 2];
        if (customColorRow.indexOf(color) !== -1) {
            customColorRow.splice(customColorRow.indexOf(color), 1);
        }
        customColorRow.unshift(color.toUpperCase());
        window.prefs.set('customColor', JSON.stringify(customColorRow));
        updatePalette(paletteName, data, builder, paletteContainer, customContainer, recentContainer);
    });
    const customColors = palette[palette.length - 2];
    for (let i = 0; i < customColors.length && i < 4; i++) {
        createColor(customContainer, builder, customColors[i], '8:' + i, undefined, data, currentColor == customColors[i], themeColors, 'custom-color');
    }
    recentContainer.replaceChildren();
    const recentColors = palette[palette.length - 1];
    for (let i = 0; i < recentColors.length && i < 8; i++) {
        createColor(recentContainer, builder, recentColors[i], '9:' + i, undefined, data, currentColor == recentColors[i], themeColors, 'recent-color');
    }
}
JSDialog.colorPicker = function (parentContainer, data, builder) {
    const container = window.L.DomUtil.create('div', 'ui-color-picker', parentContainer);
    container.id = data.id;
    container.tabIndex = '-1'; // focus should be on first element in grid for color picker
    const header = window.L.DomUtil.create('div', 'ui-color-picker-header', container);
    createAutoColorButton(header, data, builder);
    const listbox = createPaletteSwitch(header, builder);
    const paletteContainer = window.L.DomUtil.create('div', builder.options.cssClass + ' ui-color-picker-palette', container);
    const customContainer = window.L.DomUtil.createWithId('div', 'ui-color-picker-custom', container);
    const recentLabel = window.L.DomUtil.create('span', '', container);
    recentLabel.id = 'ui-color-picker-recent-label';
    recentLabel.innerText = _('Recent');
    const recentContainer = window.L.DomUtil.createWithId('div', 'ui-color-picker-recent', container);
    recentContainer.setAttribute('role', 'radiogroup');
    recentContainer.setAttribute('aria-labelledby', recentLabel.id);
    updatePalette(getCurrentPaletteName(), data, builder, paletteContainer, customContainer, recentContainer);
    listbox.addEventListener('change', () => {
        const newPaletteName = listbox.value;
        window.prefs.set('colorPalette', newPaletteName);
        updatePalette(newPaletteName, data, builder, paletteContainer, customContainer, recentContainer);
    });
    JSDialog.MakeFocusCycle(container);
    return false;
};

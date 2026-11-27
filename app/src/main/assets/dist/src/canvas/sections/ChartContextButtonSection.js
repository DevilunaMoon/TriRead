/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class ChartContextButtonSection extends GenericButtonSection {
    static { this.namePrefix = 'ChartContextButton_'; }
    static { this.classNames = [
        'general-select-theme',
        'chart-save-to-new-theme',
    ]; }
    static { this.unoCommands = [
        'uno .uno:SelectTheme',
        'uno .uno:ChartSaveToNewTheme',
    ]; }
    // Predefined sizes in pixel
    static { this.sizeButtons = 32; }
    static { this.sizeSpaceBetweenButtons = 5; }
    constructor(buttonType) {
        super(ChartContextButtonSection.namePrefix + buttonType, ChartContextButtonSection.sizeButtons, ChartContextButtonSection.sizeButtons, ChartContextButtonSection.classNames[buttonType], ChartContextButtonSection.unoCommands[buttonType]);
        this.sectionProperties.buttonType = buttonType;
        this.sectionProperties.lastInputEvent = null;
        // force update Position
        this.updatePosition();
    }
    calculatePositionPixel() {
        Util.ensureValue(GraphicSelection.rectangle);
        // calculate & return top-left position
        return [
            Math.round(GraphicSelection.rectangle.x2 * app.twipsToPixels +
                ChartContextButtonSection.sizeSpaceBetweenButtons),
            Math.round(GraphicSelection.rectangle.y1 * app.twipsToPixels +
                this.sectionProperties.buttonType *
                    (ChartContextButtonSection.sizeButtons +
                        ChartContextButtonSection.sizeSpaceBetweenButtons)),
        ];
    }
    showChartContextToolbar() {
        this.setShowSection(true);
    }
}

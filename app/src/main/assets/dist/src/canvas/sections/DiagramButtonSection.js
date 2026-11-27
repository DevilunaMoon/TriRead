/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
class DiagramButtonSection extends GenericButtonSection {
    static { this.namePrefix = 'DiagramContextButton_'; }
    static { this.className = 'general-select-theme'; }
    static { this.unoCommand = 'uno .uno:EditDiagram'; }
    // Predefined sizes in pixel
    static { this.sizeButtons = 32; }
    static { this.sizeSpaceBetweenButtons = 5; }
    constructor(_halfWidthPixels) {
        super(DiagramButtonSection.namePrefix, DiagramButtonSection.sizeButtons, DiagramButtonSection.sizeButtons, DiagramButtonSection.className, DiagramButtonSection.unoCommand);
        // fixed size pixels for the frame distance
        this.halfWidthPixels = 0;
        this.halfWidthPixels = _halfWidthPixels;
        this.sectionProperties.lastInputEvent = null;
        // force update Position
        this.updatePosition();
    }
    calculatePositionPixel() {
        Util.ensureValue(GraphicSelection.rectangle);
        // calculate & return top-left position
        return [
            Math.round(GraphicSelection.rectangle.x2 * app.twipsToPixels +
                this.halfWidthPixels +
                DiagramButtonSection.sizeSpaceBetweenButtons),
            Math.round(GraphicSelection.rectangle.y1 * app.twipsToPixels),
        ];
    }
}

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
class SplitSection extends CanvasSectionObject {
    constructor() {
        super(app.CSections.Debug.Splits.name);
        this.interactable = false;
        this.anchor = ['top', 'left'];
        this.processingOrder = app.CSections.Debug.Splits.processingOrder;
        this.drawingOrder = app.CSections.Debug.Splits.drawingOrder;
        this.zIndex = app.CSections.Debug.Splits.zIndex;
        this.boundToSection = 'tiles';
        this.sectionProperties = {
            docLayer: app.map._docLayer,
        };
    }
    onDraw() {
        const splitPanesContext = this.sectionProperties.docLayer.getSplitPanesContext();
        if (splitPanesContext) {
            var splitPos = splitPanesContext.getSplitPos();
            this.context.strokeStyle = 'red';
            this.context.strokeRect(0, 0, splitPos.x * app.dpiScale, splitPos.y * app.dpiScale);
        }
    }
}
app.definitions.splitSection = SplitSection;

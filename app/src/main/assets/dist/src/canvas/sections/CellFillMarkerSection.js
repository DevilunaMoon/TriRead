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
/* See CanvasSectionContainer.ts for explanations. */
app.definitions.CellFillMarkerSection = class CellFillMarkerSection extends (AutoFillBaseSection) {
    constructor() {
        super(app.CSections.CellFillMarker.name);
        this.processingOrder = app.CSections.CellFillMarker.processingOrder;
        this.drawingOrder = app.CSections.CellFillMarker.drawingOrder;
        this.zIndex = app.CSections.CellFillMarker.zIndex;
    }
};

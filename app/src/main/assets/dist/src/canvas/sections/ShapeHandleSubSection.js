/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
    Base class for the sub sections (handles) of ShapeHandlesSection.
    Holds the field declarations and the common setup shared by the
    scaling, custom and rotation handle sub sections.
*/
class ShapeHandleSubSection extends CanvasSectionObject {
    constructor(parentHandlerSection, sectionName, size, documentPosition, ownInfo) {
        super(sectionName);
        this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
        this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
        this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
        this.documentObject = true;
        this.size = size;
        this.sectionProperties.position = documentPosition.clone();
        this.sectionProperties.parentHandlerSection = parentHandlerSection;
        this.sectionProperties.ownInfo = ownInfo;
    }
    onInitialize() {
        this.setPosition(this.sectionProperties.position.pX, this.sectionProperties.position.pY);
    }
    onTextCursorVisibility(event) {
        if (event.detail.visible) {
            this.setShowSection(false);
            this.interactable = false;
        }
        else {
            this.setShowSection(this.sectionProperties.parentHandlerSection?.showSection ?? false);
            this.interactable =
                this.sectionProperties.parentHandlerSection?.showSection ?? false;
        }
    }
}

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
const sectionName = 'TileInvalidationRectangle';
class InvalidationRectangleSection extends CanvasSectionObject {
    constructor() {
        super(sectionName);
        /*
            We don't want visibility issues.
            Since there will be more than one rectangles in this section, position property (thus document section) is not useful anymore.
        */
        this.windowSection = true;
        this.showSection = true;
        this.zIndex = app.CSections.DefaultForDocumentObjects.zIndex;
        this.drawingOrder = app.CSections.DefaultForDocumentObjects.drawingOrder;
        this.processingOrder = app.CSections.DefaultForDocumentObjects.processingOrder;
        this.interactable = false;
        this.sectionProperties.rectangleList = [];
    }
    addRectangle(x, y, width, height) {
        const rectangleList = this.sectionProperties
            .rectangleList;
        if (rectangleList.length === 5)
            rectangleList.pop();
        rectangleList.unshift([x, y, width, height]);
    }
    onDraw(frameCount, elapsedTime, subsetBounds) {
        const rectangleList = this.sectionProperties
            .rectangleList;
        this.context.strokeStyle = 'red';
        const anchor = this.containerObject.getDocumentAnchor();
        Util.ensureValue(app.activeDocument);
        const xDiff = anchor[0] - app.activeDocument.activeLayout.viewedRectangle.pX1;
        const yDiff = anchor[1] - app.activeDocument.activeLayout.viewedRectangle.pY1;
        for (let i = 0; i < rectangleList.length; i++) {
            this.context.globalAlpha = 1 - 0.15 * i;
            this.context.strokeRect(xDiff + rectangleList[i][0], yDiff + rectangleList[i][1], rectangleList[i][2], rectangleList[i][3]);
        }
        this.context.globalAlpha = 1;
    }
    checkDeletion() {
        if (this.sectionProperties.rectangleList.length > 0) {
            this.sectionProperties.rectangleList.pop();
            setTimeout(() => {
                this.checkDeletion();
            }, 1000);
        }
        else {
            app.layoutingService.appendLayoutingTask(() => {
                app.sectionContainer.removeSection(this.name);
            });
        }
    }
    static getSection() {
        let section;
        if (app.sectionContainer.doesSectionExist(sectionName))
            section = app.sectionContainer.getSectionWithName(sectionName);
        else {
            section = new InvalidationRectangleSection();
            app.sectionContainer.addSection(section);
            setTimeout(() => {
                section.checkDeletion();
            }, 2000); // Start the cycle.
        }
        return section;
    }
    static setRectangle(x, y, width, height) {
        const section = this.getSection();
        section.addRectangle(x, y, width, height);
    }
}

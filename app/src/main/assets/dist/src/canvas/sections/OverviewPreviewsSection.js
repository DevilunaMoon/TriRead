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
/* See CanvasSectionContainer.ts for explanations. */
// Hover and selection feedback for the slide previews on the overview (canvas) page while no
// preview is entered for editing. The previews are ordinary document content painted by the
// tiles, so this overlay is what tells the user they are clickable.
class OverviewPreviewsSection extends CanvasSectionObject {
    constructor() {
        super(app.CSections.OverviewPreviews.name);
        this.processingOrder = app.CSections.OverviewPreviews.processingOrder;
        this.drawingOrder = app.CSections.OverviewPreviews.drawingOrder;
        this.zIndex = app.CSections.OverviewPreviews.zIndex;
        this.documentObject = true;
        this.boundToSection = app.CSections.Tiles.name;
        this.size = app.sectionContainer.getDocumentAnchorSection().size;
        this.sectionProperties.hoveredPart = -1;
        this.sectionProperties.cursorSet = false;
        this.sectionProperties.strokeColor =
            getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#0b87e7';
    }
    static ensure() {
        if (!app.sectionContainer.doesSectionExist(app.CSections.OverviewPreviews.name))
            app.sectionContainer.addSection(new OverviewPreviewsSection());
    }
    static remove() {
        if (app.sectionContainer.doesSectionExist(app.CSections.OverviewPreviews.name))
            app.sectionContainer.removeSection(app.CSections.OverviewPreviews.name);
    }
    // The section is created while the document is already on screen, so it places itself
    // right away. Sections placed only by the next scroll stay invisible until then.
    onInitialize() {
        this.onNewDocumentTopLeft();
    }
    onNewDocumentTopLeft() {
        this.setPosition(app.activeDocument.activeLayout.viewedRectangle.pX1, app.activeDocument.activeLayout.viewedRectangle.pY1);
    }
    viewportX(documentX) {
        return documentX - app.activeDocument.activeLayout.viewedRectangle.pX1;
    }
    viewportY(documentY) {
        return documentY - app.activeDocument.activeLayout.viewedRectangle.pY1;
    }
    // The overlay acts only on the overview page itself, outside preview edit mode.
    isApplicable() {
        return (app.map._docLayer._docType === 'presentation' &&
            app.impress.hasOverviewPage &&
            app.map._docLayer._selectedPart === 0 &&
            !app.impress.previewEditMode.active &&
            !!app.impress.previewRects);
    }
    // The preview under a section-local core-pixel point, or null.
    previewAt(x, y) {
        if (!this.isApplicable())
            return null;
        for (const preview of app.impress.previewRects) {
            const rect = preview.rectangle;
            if (x >= this.viewportX(rect.pX1) &&
                x <= this.viewportX(rect.pX2) &&
                y >= this.viewportY(rect.pY1) &&
                y <= this.viewportY(rect.pY2))
                return preview;
        }
        return null;
    }
    // True only for a point over a preview. Every other point misses, leaving this
    // section out of the hit test there.
    isHit(point) {
        return (this.previewAt(point[0] - this.myTopLeft[0], point[1] - this.myTopLeft[1]) !== null);
    }
    setHoveredPart(part) {
        if (this.sectionProperties.hoveredPart === part)
            return;
        this.sectionProperties.hoveredPart = part;
        this.containerObject.requestReDraw();
    }
    resetCursor() {
        if (this.sectionProperties.cursorSet) {
            this.context.canvas.style.cursor = '';
            this.sectionProperties.cursorSet = false;
        }
    }
    onMouseMove(point, dragDistance, e) {
        // During a drag the mouse pointer belongs to the drag itself, so this section
        // gives up its cursor claim and the dragged preview keeps the move cursor.
        if (this.containerObject.isDraggingSomething()) {
            this.resetCursor();
            return;
        }
        const preview = this.previewAt(point.pX, point.pY);
        this.setHoveredPart(preview ? preview.part : -1);
        if (preview) {
            // A preview moves with a drag whether or not it is selected, and the mouse
            // pointer messages from the document say the same, so the move cursor is
            // the one steady answer over a preview.
            this.context.canvas.style.cursor = 'move';
            this.sectionProperties.cursorSet = true;
        }
        else
            this.resetCursor();
    }
    onMouseLeave() {
        this.setHoveredPart(-1);
        this.resetCursor();
    }
    onDraw() {
        if (!this.isApplicable())
            return;
        for (const preview of app.impress.previewRects) {
            const rect = preview.rectangle;
            const x = this.viewportX(rect.pX1);
            const y = this.viewportY(rect.pY1);
            if (preview.part === app.impress.selectedPreviewPart) {
                this.context.beginPath();
                this.context.strokeStyle = this.sectionProperties.strokeColor;
                this.context.lineWidth = 2;
                this.context.strokeRect(x, y, rect.pWidth, rect.pHeight);
                this.context.globalAlpha = 0.08;
                this.context.fillStyle = this.sectionProperties.strokeColor;
                this.context.fillRect(x, y, rect.pWidth, rect.pHeight);
                this.context.globalAlpha = 1;
                this.context.closePath();
            }
            else if (preview.part === this.sectionProperties.hoveredPart) {
                this.context.beginPath();
                this.context.strokeStyle = this.sectionProperties.strokeColor;
                this.context.lineWidth = 1;
                this.context.strokeRect(x, y, rect.pWidth, rect.pHeight);
                this.context.closePath();
            }
        }
    }
}

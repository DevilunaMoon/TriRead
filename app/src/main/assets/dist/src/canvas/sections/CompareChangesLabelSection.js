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
/*
 * CompareChangesLabelSection - draws "Original" and "Current" labels above
 * the left and right pages in the compare changes view.
 */
class CompareChangesLabelSection extends HTMLObjectSection {
    constructor() {
        super(app.CSections.CompareChangesLabel.name, 0, 0, new cool.SimplePoint(0, 0), 'compare-changes-labels');
        this.processingOrder = app.CSections.CompareChangesLabel.processingOrder;
        this.drawingOrder = app.CSections.CompareChangesLabel.drawingOrder;
        this.zIndex = app.CSections.CompareChangesLabel.zIndex;
        this.documentObject = false;
        this.interactable = false;
        this.boundToSection = 'tiles';
        this.anchor = ['top', 'left'];
        this.labelHeight = 32;
        this.leftLabel = document.createElement('div');
        this.leftTitle = document.createElement('div');
        this.leftSubtitle = document.createElement('div');
        this.rightLabel = document.createElement('div');
        this.rightTitle = document.createElement('div');
        this.rightSubtitle = document.createElement('div');
        this.setupLabels();
    }
    setupLabels() {
        const container = this.getHTMLObject();
        container.style.pointerEvents = 'none';
        container.style.overflow = 'visible';
        // Be on top of the text cursor.
        container.style.zIndex = '1001';
        this.leftLabel.id = 'compare-changes-left-label';
        this.leftTitle.id = 'compare-changes-left-title';
        this.leftSubtitle.id = 'compare-changes-left-subtitle';
        this.rightLabel.id = 'compare-changes-right-label';
        this.rightTitle.id = 'compare-changes-right-title';
        this.rightSubtitle.id = 'compare-changes-right-subtitle';
        this.setupLabel(container, this.leftLabel, this.leftTitle, this.leftSubtitle);
        this.setupLabel(container, this.rightLabel, this.rightTitle, this.rightSubtitle);
    }
    setupLabel(container, label, title, subtitle) {
        label.style.height = this.labelHeight + 'px';
        title.style.fontSize = '16px';
        title.style.lineHeight = '16px';
        subtitle.style.fontSize = '12px';
        subtitle.style.lineHeight = '16px';
        label.appendChild(title);
        label.appendChild(subtitle);
        container.appendChild(label);
    }
    static setTextContent(element, text) {
        if (element.textContent !== text) {
            element.textContent = text;
        }
    }
    updateSubtitle(element, info) {
        const locale = String.locale;
        const dateOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        const date = new Date(info.modificationDate).toLocaleDateString(locale, dateOptions);
        CompareChangesLabelSection.setTextContent(element, _('Last edited by %1 on %2')
            .replace('%1', info.modifiedBy)
            .replace('%2', date));
    }
    checkSettings() {
        if (app.activeDocument) {
            this.size = app.activeDocument.fileSize.pToArray();
            const layoutCheck = app.activeDocument.activeLayout.type === 'ViewLayoutCompareChanges';
            if (!layoutCheck) {
                if (this.isSectionShown())
                    this.setShowSection(false);
                return false;
            }
            else {
                if (!this.isSectionShown())
                    this.setShowSection(true);
                return true;
            }
        }
        else
            return false;
    }
    onNewDocumentTopLeft() {
        super.onNewDocumentTopLeft();
        this.checkSettings();
    }
    onDraw() {
        if (!this.checkSettings() || !app.activeDocument)
            return;
        this.adjustHTMLObjectPosition();
        const layout = app.activeDocument.activeLayout;
        // Use page rectangle to get actual page position and width (in twips).
        const pageRects = app.file.writer.pageRectangleList;
        if (!pageRects || pageRects.length === 0) {
            return;
        }
        const firstPage = pageRects[0];
        // firstPage has its dimensions as x, y, w, h; in twips.
        const pageX = firstPage[0];
        const pageY = firstPage[1];
        // documentToViewX/Y and twipsToPixels return core (device) pixels, but
        // the labels are positioned via DOM styles which use CSS pixels. Divide
        // by dpiScale to convert, matching HTMLObjectSection.adjustHTMLObjectPosition.
        const pageWidth = Math.round((firstPage[2] * app.twipsToPixels) / app.dpiScale);
        // Left page label position.
        const part = -1;
        const leftOrigin = new cool.SimplePoint(pageX, pageY, part, TileMode.LeftSide);
        const leftX = layout.documentToViewX(leftOrigin) / app.dpiScale;
        const topY = layout.documentToViewY(leftOrigin) / app.dpiScale - this.labelHeight;
        // Right page label position.
        const rightOrigin = new cool.SimplePoint(pageX, pageY, part, TileMode.RightSide);
        const rightX = layout.documentToViewX(rightOrigin) / app.dpiScale;
        const props = app.writer.compareDocumentProperties;
        if (props) {
            const docName = document.getElementById('document-name-input')
                ?.value || '';
            // See if onCompareDocuments() has an old doc name for us.
            const oldDocName = app.writer.compareDocumentOldFileName || docName;
            CompareChangesLabelSection.setTextContent(this.leftTitle, _('%1: Initial Version').replace('%1', oldDocName));
            CompareChangesLabelSection.setTextContent(this.rightTitle, _('%1: Current Version').replace('%1', docName));
            this.updateSubtitle(this.leftSubtitle, props.metadata.otherDocument);
            this.updateSubtitle(this.rightSubtitle, props.metadata.thisDocument);
        }
        else {
            CompareChangesLabelSection.setTextContent(this.leftTitle, _('Initial Version'));
            CompareChangesLabelSection.setTextContent(this.rightTitle, _('Current Version'));
        }
        // We only have a subtitle right after comparing; so if we don't have a subtitle,
        // center the title vertically.
        const titleHeight = props ? this.labelHeight / 2 : this.labelHeight;
        this.leftTitle.style.lineHeight = titleHeight + 'px';
        this.rightTitle.style.lineHeight = titleHeight + 'px';
        this.leftLabel.style.left = leftX + 'px';
        this.leftLabel.style.top = topY + 'px';
        this.leftLabel.style.width = pageWidth + 'px';
        this.rightLabel.style.left = rightX + 'px';
        this.rightLabel.style.top = topY + 'px';
        this.rightLabel.style.width = pageWidth + 'px';
    }
}

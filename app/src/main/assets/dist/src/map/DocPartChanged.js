/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// Posts Doc_PartChanged when the current part, the part count or the document type changes. The
// posted Part counts from 1. An event that repeats the last values posts nothing. So does a part
// event that lacks one of the three values, or a page event that lacks the page or the page count.
class DocPartChanged {
    constructor(post) {
        this.lastPart = -1;
        this.lastPartCount = -1;
        this.lastDocType = '';
        this.post = post;
    }
    listenTo(map) {
        map.on('pagenumberchanged', (e) => this.onPageNumberChanged(e), map);
        map.on('setpart', (e) => this.onSetPart(e), map);
        map.on('updateparts', (e) => this.onUpdateParts(e), map);
    }
    onPageNumberChanged(e) {
        if (!e)
            return;
        this.update(e.currentPage, e.pages, e.docType);
    }
    onSetPart(e) {
        this.onPartEvent(e);
    }
    onUpdateParts(e) {
        this.onPartEvent(e);
    }
    onPartEvent(e) {
        if (!e ||
            e.selectedPart === undefined ||
            e.parts === undefined ||
            e.docType === undefined)
            return;
        this.update(e.selectedPart, e.parts, e.docType);
    }
    update(part, partCount, docType) {
        const normalizedPart = Number(part);
        const normalizedPartCount = Number(partCount);
        if (!Number.isInteger(normalizedPart) ||
            !Number.isInteger(normalizedPartCount))
            return;
        if (normalizedPart === this.lastPart &&
            normalizedPartCount === this.lastPartCount &&
            docType === this.lastDocType)
            return;
        this.lastPart = normalizedPart;
        this.lastPartCount = normalizedPartCount;
        this.lastDocType = docType;
        this.post({
            msgId: 'Doc_PartChanged',
            args: {
                Part: normalizedPart + 1,
                PartCount: normalizedPartCount,
                DocType: docType,
            },
        });
    }
}

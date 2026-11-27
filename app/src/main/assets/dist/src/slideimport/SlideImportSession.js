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
class SlideImportSession {
    constructor(map) {
        this.state = 'idle';
        this.fileName = '';
        // How many slides the source holds, which bounds every index a selection
        // or an insert names.
        this.slideCount = 0;
        this.selection = new Set();
        this.keepDesign = false;
        // Whether the inserted slides stay bound to the file they came from, so
        // that they can be updated from it later. The user's choice, kept across
        // files.
        this.linkToSource = false;
        // Whether the inserted slides are linked to the position their slides hold in the source
        // rather than to the slides themselves. The user's choice, kept across files.
        this.linkByPosition = false;
        // Whether slides that make up a whole section of the source go in as a
        // section of their own rather than as plain slides. The user's choice, kept
        // across files.
        this.insertAsSection = true;
        // Whether the slides on show can be linked to their source.
        this.canLink = false;
        this.error = null;
        // Insert commands sent whose reply has not arrived yet.
        this.pendingInserts = 0;
        // The slides an insert is waiting on the source to write, and where they go.
        this.pendingInsert = null;
        this.map = map;
        map.on('slideimport', this.onImportMessage, this);
        map.on('slideimporterror', this.onErrorMessage, this);
        app.events.on('slideimport:dropinsert', this.onDropInsert.bind(this));
    }
    // The pages the source wrote are staged in this document's jail, and the insert takes that
    // file. The pane asks for the export and hands the staged name over. section is the section
    // of the source the slides go in as, which they make up all of and nothing else, or null for
    // slides that go in as slides. A linked section follows that source section.
    insertStaged(stagedName, at, section) {
        const link = this.linkToSource && this.canLink;
        const source = this.sourceName();
        // A linked page records the time its source was last modified now, so a
        // later comparison tells whether it is up to date.
        const time = link ? SlideImportSession.sourceModifiedTime(source) : '';
        // A page linked by position records the place its slide holds in the source, which is
        // the slide this insert asked the source for, counted from one.
        const positions = link && this.linkByPosition && this.pendingInsert
            ? this.pendingInsert.slides.map((index) => index + 1)
            : [];
        app.socket.sendMessage('slideimport insert file=' +
            encodeURIComponent(stagedName) +
            (source ? ' source=' + encodeURIComponent(source) : '') +
            ' at=' +
            at +
            ' keepdesign=' +
            (this.keepDesign ? '1' : '0') +
            ' link=' +
            (link ? '1' : '0') +
            (positions.length ? ' sourcepositions=' + positions.join(',') : '') +
            (time ? ' time=' + encodeURIComponent(time) : '') +
            (section
                ? ' section=' +
                    encodeURIComponent(section.id) +
                    ' sectionname=' +
                    encodeURIComponent(section.name)
                : ''));
    }
    // The persistent link of the document the slides come from.
    setSource(fileName) {
        this.fileName = fileName;
        this.canLink = this.sourceName() !== '' && this.formatKeepsLinks();
        this.setState('opening');
    }
    // Does the format this document is saved in keep the link of an inserted page.
    formatKeepsLinks() {
        return app.LOUtil.isFileODF(this.map);
    }
    // The slides of the document are on show, so they can be chosen and inserted.
    slidesShown() {
        this.setError(null);
        this.setState('ready');
    }
    sourceName() {
        const name = this.fileName;
        if (name === '')
            return '';
        for (let i = 0; i < name.length; i++)
            if (name.charCodeAt(i) < 0x20)
                return '';
        return name;
    }
    setKeepDesign(value) {
        this.keepDesign = value;
    }
    setLinkToSource(value) {
        this.linkToSource = value;
    }
    setInsertAsSection(value) {
        this.insertAsSection = value;
    }
    setLinkByPosition(value) {
        this.linkByPosition = value;
    }
    toggleSelection(index) {
        if (this.selection.has(index))
            this.selection.delete(index);
        else
            this.selection.add(index);
        this.fireEvent('slideimport:selection', {});
    }
    selectOnly(index) {
        this.selection.clear();
        this.selection.add(index);
        this.fireEvent('slideimport:selection', {});
    }
    // Replaces the selection with the given slide indices.
    setSelection(indices) {
        this.selection.clear();
        for (const index of indices)
            this.selection.add(index);
        this.fireEvent('slideimport:selection', {});
    }
    // Takes the given slides into the selection or out of it, and leaves the
    // rest of the selection as it is.
    setSelected(indices, selected) {
        for (const index of indices) {
            if (selected)
                this.selection.add(index);
            else
                this.selection.delete(index);
        }
        this.fireEvent('slideimport:selection', {});
    }
    selectRange(anchor, index) {
        const from = Math.max(0, Math.min(anchor, index));
        const to = Math.min(this.slideCount - 1, Math.max(anchor, index));
        const indices = [];
        for (let i = from; i <= to; i++)
            indices.push(i);
        this.setSelection(indices);
    }
    clearSelection() {
        this.selection.clear();
        this.fireEvent('slideimport:selection', {});
    }
    // The slide the next insert lands after, counted from one, or 0 for the
    // end of the document. insertSelected takes the same route.
    insertAfter() {
        const docLayer = this.map._docLayer;
        if (!docLayer || docLayer._selectedPart === undefined)
            return 0;
        return docLayer._selectedPart + 1;
    }
    // Inserts the selected slides after the slide the user is on.
    insertSelected() {
        if (this.state !== 'ready' || this.selection.size === 0)
            return;
        const slides = Array.from(this.selection).sort((a, b) => a - b);
        const docLayer = this.map._docLayer;
        const at = docLayer && docLayer._selectedPart !== undefined
            ? docLayer._selectedPart + 1
            : this.map.getNumberOfParts();
        this.requestInsert(slides, at);
    }
    // A thumbnail dragged onto the slides list drops here. pos follows the
    // reorder convention: -1 places the slides before the first slide, and
    // a value k places them after slide k. slideimport insert takes an at
    // index that inserts before a slide, so at is one past pos.
    onDropInsert(e) {
        if (this.state !== 'ready')
            return;
        const detail = e.detail || {};
        const wanted = (Array.isArray(detail.slides) ? detail.slides : [])
            .filter((i) => i >= 0 && i < this.slideCount)
            .sort((a, b) => a - b);
        if (wanted.length === 0)
            return;
        const pos = typeof detail.pos === 'number' ? detail.pos : -1;
        this.requestInsert(wanted, pos + 1);
    }
    close() {
        this.fileName = '';
        this.canLink = false;
        this.resetImportState();
        this.setError(null);
        this.setState('idle');
    }
    setState(state) {
        this.state = state;
        this.fireEvent('slideimport:statechange', { state: state });
    }
    // Says why the slides of a pick are not on show.
    showError(message) {
        this.setError({ message: message, retry: null });
    }
    exportFailed() {
        if (this.pendingInserts > 0)
            this.pendingInserts--;
        const insert = this.pendingInsert;
        this.pendingInsert = null;
        if (this.state === 'inserting')
            this.setState('ready');
        this.setError({
            message: _('The slides of the source could not be read.'),
            retry: insert ? () => this.requestInsert(insert.slides, insert.at) : null,
        });
    }
    setError(error) {
        if (error === null && this.error === null)
            return;
        this.error = error;
        this.fireEvent('slideimport:error', {});
    }
    fireEvent(name, detail) {
        app.events.fire(name, detail);
    }
    resetImportState() {
        this.slideCount = 0;
        this.selection.clear();
        this.pendingInsert = null;
    }
    onImportMessage(e) {
        const message = e.message;
        if (!message || !message.status)
            return;
        if (message.status === 'inserted') {
            this.pendingInserts = Math.max(0, this.pendingInserts - 1);
            // The slides of the insert are in the document, so nothing is waiting to be
            // inserted whatever state the pane has moved on to.
            this.pendingInsert = null;
            // The insert this answers was abandoned by a close or a new
            // file pick; the session has moved on.
            if (this.state !== 'inserting')
                return;
            this.selection.clear();
            this.setState('ready');
            this.fireEvent('slideimport:inserted', { count: message.count });
        }
    }
    onErrorMessage(e) {
        // Every kind an insert can be answered with reaches the insert below: cantload says
        // the file the source wrote is no longer staged, and the others that the document
        // refused the pages. A kind that arrives while nothing is being inserted belongs to
        // an insert the pane has already moved on from.
        if (this.pendingInserts > 0 && this.state !== 'ready') {
            this.pendingInserts--;
            if (this.state === 'inserting') {
                const insert = this.pendingInsert;
                this.pendingInsert = null;
                this.setState('ready');
                this.setError({
                    message: _('Inserting the slides failed.'),
                    retry: insert
                        ? () => this.requestInsert(insert.slides, insert.at)
                        : null,
                });
            }
            else {
                // The pane was closed while the insert was still running.
                // The document was not changed, so say so out loud.
                this.map.fire('error', {
                    msg: _('Inserting the slides failed.'),
                    critical: false,
                });
            }
            return;
        }
        if (this.state === 'opening') {
            this.setState('idle');
            this.setError({ message: _('Importing slides failed.'), retry: null });
        }
    }
    // The slides a user chose, and where they go. The pane asks the source to write them out
    // and hands back the name they were staged under.
    requestInsert(slides, at) {
        this.pendingInsert = { slides: slides, at: at };
        this.pendingInserts++;
        this.setError(null);
        this.setState('inserting');
        this.fireEvent('slideimport:exportwanted', {});
    }
    /// The slides the insert being prepared asks for, in the order they were chosen.
    getPendingInsert() {
        return this.pendingInsert;
    }
    // The remote link as the user knows it: the name the server gave it, or
    // its persistent link when the server gave none.
    static documentName(doc) {
        return doc.name || doc.persistentLink;
    }
    // Whether a remote link is the one a source names.
    static matchesDocument(doc, source) {
        return !!doc.persistentLink && doc.persistentLink === source;
    }
    // The time the remote link of the given name was last modified now, as
    // the storage announced it, or empty when the storage named no such
    // document or gave it no time.
    static sourceModifiedTime(source) {
        if (!source)
            return '';
        for (const doc of app.remoteLinks || []) {
            if (SlideImportSession.matchesDocument(doc, source) &&
                doc.lastModifiedTime)
                return doc.lastModifiedTime;
        }
        return '';
    }
    // Asks the server to open a live link to the remote link bound to a
    // persistent link; the state in the next remotelinks: message follows the
    // subscription.
    static subscribeRemoteLink(persistentLink) {
        app.socket.sendMessage('remotedocsubscribe source=' + encodeURIComponent(persistentLink));
    }
    // Asks the server to look for the document behind a persistent link.
    static resolveRemoteLink(persistentLink) {
        app.socket.sendMessage('remotelinkresolve source=' + encodeURIComponent(persistentLink));
    }
    // Asks the server to drop the remote link bound to a persistent link, for
    // every view of the document.
    static removeRemoteLink(persistentLink) {
        app.socket.sendMessage('remotelinkremove source=' + encodeURIComponent(persistentLink));
    }
    // Sends a read-only client command to the subscribed remote document bound
    // to a persistent link. Its reply arrives as a remotedoccommandresult map
    // event carrying the same source.
    static sendRemoteCommand(persistentLink, inner) {
        app.socket.sendMessage('remotedoccommand source=' +
            encodeURIComponent(persistentLink) +
            ' ' +
            inner);
    }
    static exportFailureKind(json) {
        try {
            const written = JSON.parse(json);
            return written && written.status === 'failed' && written.kind
                ? written.kind
                : '';
        }
        catch {
            return '';
        }
    }
    // The name the server staged an exported presentation under, from the
    // body of an exportslides: reply, or an empty string when nothing was
    // staged.
    static stagedExportName(json) {
        try {
            const written = JSON.parse(json);
            return written && written.status === 'staged' && written.name
                ? written.name
                : '';
        }
        catch {
            return '';
        }
    }
}

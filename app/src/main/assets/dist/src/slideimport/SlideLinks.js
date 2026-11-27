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
class SlideLinks {
    constructor(map) {
        this.pages = new Map();
        // The sources the document links to, in the order the list reports them.
        this.sources = [];
        // The linked sections of the document, by the identifier of each one.
        this.sections = new Map();
        // The slides a source reports, by the identifier of each one, the
        // identifiers of its sections, and the time that source was last modified
        // when they were read. A null set stands for a source that has been asked
        // and has not answered yet.
        this.sourceSlides = new Map();
        // Whether the link list of this load has been asked for.
        this.loaded = false;
        this.queue = [];
        // The refresh the server is running, or null.
        this.running = null;
        // Whether a list arrived that names parts this view does not know yet, so
        // the change is announced once the part list has caught up.
        this.announceOnParts = false;
        // The parts of the view's part list when it last changed, or null before
        // the first part list of a load.
        this.knownParts = null;
        this.map = map;
        map.on('docloaded', this.onDocLoaded, this);
        map.on('slidelinks', this.onList, this);
        map.on('updateparts', this.onUpdateParts, this);
        map.on('slidelink', this.onUpdated, this);
        map.on('remotedoccommandresult', this.onRemoteResult, this);
        map.on('remotelinks', this.onRemoteLinks, this);
        map.on('slidelinkerror', this.onError, this);
        map.on('slideimport', this.onImportMessage, this);
    }
    // Whether a page or a section of this document is linked to another file.
    hasLinks() {
        return this.sources.length > 0 || this.sections.size > 0;
    }
    // The source of this document's links that names the given remote
    // link, or an empty string when no page and no section is linked to it.
    linkedSourceOf(doc) {
        return (this.linkedSources().find((source) => SlideImportSession.matchesDocument(doc, source)) || '');
    }
    // The source document a page was made from and the slide of it, or null
    // for a page that is linked to nothing.
    getPageLink(part) {
        const link = this.pages.get(part);
        return link ? { source: link.source, name: link.name } : null;
    }
    getSourceSlideName(part) {
        const link = this.pages.get(part);
        if (!link || !link.sourceGuid)
            return '';
        const slides = this.sourceSlides.get(link.source);
        return (slides && slides.names.get(link.sourceGuid)) || '';
    }
    isPageOutdated(part) {
        const link = this.pages.get(part);
        return !!link && this.isOutdated(link);
    }
    // How many pages of this document came from one source, and how many of
    // those the source has changed since. Only linked pages are counted,
    // because a plain copy records nothing to count.
    countPagesFrom(source) {
        let count = 0;
        this.pages.forEach((link) => {
            if (link.source === source)
                count++;
        });
        return count;
    }
    countOutdatedPagesFrom(source) {
        let count = 0;
        this.pages.forEach((link, part) => {
            if (link.source === source && this.isPageOutdated(part))
                count++;
        });
        return count;
    }
    // isPageBroken is only true when the source file is missing, or when
    // the slide in the source has been removed. No access and could not
    // open are not factored in, so the badge keeps the link icon for those.
    isPageBroken(part) {
        const link = this.pages.get(part);
        if (!link)
            return false;
        return (this.sourceState(link.source) === 'missing' || this.isPageMissing(part));
    }
    isPageMissing(part) {
        const link = this.pages.get(part);
        if (!link || !link.sourceGuid || link.name)
            return false;
        const slides = this.sourceSlides.get(link.source);
        if (!slides || slides.guids === null)
            return false;
        return !slides.guids.has(link.sourceGuid);
    }
    isPageConnected(part) {
        return this.getPageSourceState(part) === 'connected';
    }
    // The state of the remote link a page's source names, as the
    // storage announced it, or an empty string when this document links
    // to no document of that name or the page is linked to nothing.
    getPageSourceState(part) {
        const link = this.pages.get(part);
        return link ? this.sourceState(link.source) : '';
    }
    // The state the mark of a page shows.
    getPageLinkState(part) {
        const link = this.pages.get(part);
        if (!link)
            return '';
        return this.linkState(link, this.isPageBroken(part));
    }
    // Whether the source of a page can be read, so that its pages can be
    // refreshed from it.
    isPageUpdatable(part) {
        return SlideLinks.isReadable(this.getPageSourceState(part));
    }
    // The source a section of this document holds a copy of a section of, or
    // null for a section that is linked to nothing.
    getSectionLink(section) {
        const link = this.sections.get(section);
        return link ? { source: link.source } : null;
    }
    // Whether the source of a linked section was modified since the section
    // was last read from it.
    isSectionOutdated(section) {
        const link = this.sections.get(section);
        return !!link && this.isOutdated(link);
    }
    // Whether the source document of a linked section is missing, or the
    // source was read and holds no section with the identifier the link records.
    isSectionMissing(section) {
        const link = this.sections.get(section);
        if (!link)
            return false;
        if (this.sourceState(link.source) === 'missing')
            return true;
        const known = this.sourceSlides.get(link.source);
        return (!!known &&
            known.sections !== null &&
            !known.sections.has(link.sourceSection));
    }
    // The state of the remote link the source of a linked section names, as
    // the storage announced it, or an empty string.
    getSectionSourceState(section) {
        const link = this.sections.get(section);
        return link ? this.sourceState(link.source) : '';
    }
    // The state the mark of a section shows.
    getSectionLinkState(section) {
        const link = this.sections.get(section);
        if (!link)
            return '';
        return this.linkState(link, this.isSectionMissing(section));
    }
    // The state of a link, given whether the slides it came from are gone.
    linkState(link, broken) {
        if (broken)
            return 'broken';
        if (this.isOutdated(link))
            return 'outdated';
        const state = this.sourceState(link.source);
        if (state === 'connected' || state === 'disconnected')
            return state;
        return 'linked';
    }
    // Whether the source was modified since the link was last read from it.
    isOutdated(link) {
        if (!link.lastModifiedTime)
            return false;
        const current = this.currentSourceTime(link.source);
        return current !== null && current !== link.lastModifiedTime;
    }
    // The state of the remote link a source names, as the storage announced
    // it, or an empty string when this document links to no document of that
    // name.
    sourceState(source) {
        const remoteLink = this.remoteLink(source);
        return remoteLink ? remoteLink.state : '';
    }
    // Whether the source of a linked section can be read, so that the section
    // can be brought up to date from it.
    isSectionUpdatable(section) {
        return (!this.isSectionMissing(section) &&
            SlideLinks.isReadable(this.getSectionSourceState(section)));
    }
    // Whether a source in the given state can be read: the storage named it,
    // this view holds a token for it, and reading it has not failed.
    static isReadable(state) {
        return (state !== '' &&
            state !== 'noaccess' &&
            state !== 'missing' &&
            state !== 'failed');
    }
    // The identifier of the slide on show, or an empty string when the
    // document shows no slide.
    currentPart() {
        return this.map._docLayer ? this.map._docLayer.getSelectedPart() : '';
    }
    currentSourceTime(source) {
        const remoteLink = this.remoteLink(source);
        return remoteLink && remoteLink.lastModifiedTime
            ? remoteLink.lastModifiedTime
            : null;
    }
    // Refreshes the pages of every source of this document. The server reads
    // each source as a remote link of this one, so nothing is asked of
    // the user beyond the command itself.
    updateAll() {
        if (!this.map.isEditMode())
            return;
        if (!this.hasLinks()) {
            this.say(_('No slide of this presentation is linked to another file.'));
            return;
        }
        // This run covers the sources and the sections the document holds now.
        for (const source of this.sources)
            this.updatePagesOf(source);
        this.confirmSectionUpdate(Array.from(this.sections.keys()));
    }
    // The identifier of the linked section that holds the slide on show, or an
    // empty string when that slide is in no linked section.
    currentSection() {
        const layer = this.map._docLayer;
        const index = layer ? layer._selectedPart : -1;
        const sections = (app.impress && app.impress.sections) || [];
        for (const section of sections) {
            if (!section.id || !this.sections.has(section.id))
                continue;
            if (index >= section.startIndex &&
                index < section.startIndex + section.slideCount)
                return section.id;
        }
        return '';
    }
    // The page keeps the content it holds and becomes a regular page
    // of this document.
    breakLink(part) {
        if (!this.map.isEditMode())
            return;
        if (!this.pages.has(part))
            return;
        app.socket.sendMessage('slidelink break part=' + part);
    }
    // The section keeps the slides it holds and no longer follows its source
    // section. With slides, each slide of it becomes a regular page of this
    // document as well, and otherwise each stays linked to its source slide.
    breakSectionLink(section, slides) {
        if (!this.map.isEditMode())
            return;
        if (!this.sections.has(section))
            return;
        app.socket.sendMessage('slidelink break section=' +
            encodeURIComponent(section) +
            (slides ? ' slides=1' : ''));
    }
    // Gives a linked section the slides its source section holds now. Every
    // slide of the section is replaced, a slide changed here as well, so the
    // user confirms first.
    updateSection(section) {
        if (!this.map.isEditMode())
            return;
        if (!this.sections.has(section))
            return;
        if (!this.isSectionUpdatable(section)) {
            this.say(_('The section cannot be updated, because its source is not available.'));
            return;
        }
        this.confirmSectionUpdate([section]);
    }
    // Asks the user once whether the given linked sections may be replaced by
    // what their source sections hold now, and queues their updates. A section
    // whose source cannot be read, or that is already queued, is left out.
    confirmSectionUpdate(sections) {
        const linked = sections.filter((section) => this.sections.has(section) && !this.isSectionQueued(section));
        const wanted = linked.filter((section) => this.isSectionUpdatable(section));
        // A section whose source cannot be read is left as it is, and the user
        // is told so.
        if (wanted.length < linked.length)
            this.say(linked.length - wanted.length === 1
                ? _('One linked section cannot be updated, because its source is not available.')
                : _('{0} linked sections cannot be updated, because their sources are not available.').replace('{0}', String(linked.length - wanted.length)));
        if (wanted.length === 0)
            return;
        const first = this.sections.get(wanted[0]);
        const message = wanted.length === 1
            ? _('The section will hold the slides that its section in {0} holds now. Changes made to these slides in this presentation will be lost.').replace('{0}', () => first.source)
            : _('{0} linked sections will hold the slides that their sections in the source files hold now. Changes made to these slides in this presentation will be lost.').replace('{0}', String(wanted.length));
        this.map.uiManager.showConfirmModal('slidelink-update-section', wanted.length === 1 ? _('Update section') : _('Update sections'), message, _('Update'), () => {
            // The list may have changed while the user was asked.
            for (const section of wanted) {
                const current = this.sections.get(section);
                if (!current || this.isSectionQueued(section))
                    continue;
                this.queue.push({
                    kind: 'section',
                    source: current.source,
                    step: 'waiting',
                    section: section,
                    sourceSectionName: '',
                });
            }
            this.sendNext();
        });
    }
    // Whether an update of the given section is running or waiting for its turn.
    isSectionQueued(section) {
        const updates = (refresh) => refresh !== null &&
            refresh.kind === 'section' &&
            refresh.section === section;
        return updates(this.running) || this.queue.some(updates);
    }
    // Refreshes the pages of one source, and the sections linked to it once the
    // user confirms. A source that is already being read, or waiting for its
    // turn, is left where it is, so asking twice refreshes it once.
    updateSource(source) {
        if (!this.map.isEditMode())
            return;
        this.updatePagesOf(source);
        const sections = [];
        this.sections.forEach((link, section) => {
            if (link.source === source)
                sections.push(section);
        });
        this.confirmSectionUpdate(sections);
    }
    // Refreshes the pages linked to one source, and leaves its sections as they
    // are.
    updatePagesOf(source) {
        if (this.sources.indexOf(source) < 0)
            return;
        if (this.covers(this.running, source))
            return;
        if (this.queue.some((refresh) => this.covers(refresh, source)))
            return;
        // The pages of this source waiting to be read on their own are read
        // with the rest of it.
        this.queue = this.queue.filter((refresh) => refresh.source !== source ||
            refresh.kind !== 'pages' ||
            refresh.part === undefined);
        this.enqueue(source);
    }
    // Refreshes one page from its source, and leaves every other page of that
    // source as it is. The source writes its pages out as for a whole refresh,
    // and the document reads the one page from them.
    updatePage(part) {
        if (!this.map.isEditMode())
            return;
        const link = this.pages.get(part);
        if (!link) {
            this.say(_('This slide is not linked to another file.'));
            return;
        }
        // A refresh already waiting reads this page, on its own or with the
        // rest of its source, so asking twice reads it once.
        if (this.covers(this.running, link.source, part))
            return;
        if (this.queue.some((refresh) => this.covers(refresh, link.source, part)))
            return;
        this.enqueue(link.source, part);
    }
    // Whether a refresh reads the given page of the given source, on its own
    // or with the rest of that source; with no page, whether it reads every
    // page of the source.
    covers(refresh, source, part) {
        return (refresh !== null &&
            refresh.kind === 'pages' &&
            refresh.source === source &&
            (refresh.part === undefined || refresh.part === part));
    }
    say(message) {
        this.map.uiManager.showSnackbar(message);
    }
    onDocLoaded(e) {
        // The connection went down, or the load failed. wsd forgets the
        // refreshes of a session that leaves, so nothing in flight will be
        // answered again: drop it all, and let the next load start clean.
        if (e.status === false) {
            this.loaded = false;
            this.knownParts = null;
            this.abandonUpdate();
            return;
        }
        if (!this.map.isPresentationOrDrawing())
            return;
        // Every status update of the open document fires this event again,
        // so the list is read once per load.
        if (this.loaded)
            return;
        this.loaded = true;
        app.socket.sendMessage('slidelink list');
    }
    // Drops the update in hand: the refresh being run and the sources waiting
    // for their turn.
    abandonUpdate() {
        this.queue = [];
        this.running = null;
    }
    // Slides inserted from another file can be links to it, so the list is
    // read again once an insert is done.
    onImportMessage(e) {
        if (e.message && e.message.status === 'inserted')
            app.socket.sendMessage('slidelink list');
    }
    onList(e) {
        const links = e.message && Array.isArray(e.message.links) ? e.message.links : [];
        this.pages.clear();
        this.sources = [];
        this.sections.clear();
        const sections = e.message && Array.isArray(e.message.sections) ? e.message.sections : [];
        for (const entry of sections) {
            if (!entry || !entry.section || !entry.source)
                continue;
            this.sections.set(entry.section, {
                source: entry.source,
                sourceSection: entry.sourceSection || '',
                sourceSectionName: entry.sourceSectionName || '',
                lastModifiedTime: entry.lastModifiedTime || '',
            });
        }
        for (const entry of links) {
            if (!entry || !entry.source || !Array.isArray(entry.slides))
                continue;
            this.sources.push(entry.source);
            for (const slide of entry.slides)
                this.pages.set(slide.part, {
                    source: entry.source,
                    name: slide.name,
                    sourceGuid: slide.sourceGuid || '',
                    lastModifiedTime: slide.lastModifiedTime || '',
                });
        }
        this.readSourceSlides();
        // A refreshed page is a new page, and the list reaches a view before
        // the status that renews its part list. Announced now, a list naming
        // a part the view does not know yet would read the slide on show as
        // linked to nothing for a moment, so it is announced with that status.
        if (this.namesUnknownPart())
            this.announceOnParts = true;
        else
            app.events.fire('slidelink:changed', {});
        this.showUpdateCommand();
    }
    // Whether the list names a part the view's part list does not hold.
    namesUnknownPart() {
        const layer = this.map._docLayer;
        if (!layer)
            return false;
        for (const part of this.pages.keys())
            if (layer.getIndexFromPart(part) < 0)
                return true;
        return false;
    }
    // A slide added or removed by any means, such as a delete, a paste or an
    // undo, can add or drop a link, so the list is read again. A list waiting
    // for this part list already names its parts, so it is announced instead.
    onUpdateParts() {
        const changed = this.partsChanged();
        if (this.announceOnParts) {
            this.announceOnParts = false;
            app.events.fire('slidelink:changed', {});
        }
        else if (changed && this.loaded)
            app.socket.sendMessage('slidelink list');
    }
    // Whether the part list holds other parts than at its last change. The
    // first part list of a load is read with the link list of that load.
    partsChanged() {
        const list = (app.impress && app.impress.partList) || [];
        const parts = new Set(list.map((info) => info.part));
        const known = this.knownParts;
        this.knownParts = parts;
        if (!known)
            return false;
        if (known.size !== parts.size)
            return true;
        for (const part of parts)
            if (!known.has(part))
                return true;
        return false;
    }
    // The command that updates the linked slides is offered by a document
    // that holds some, and by no other. Each bar is told on its own, and the
    // menubar keeps a record of its own that its rebuilds read.
    showUpdateCommand() {
        if (window.coolPreview) {
            return;
        }
        const offered = this.hasLinks();
        const notebookbar = this.map.uiManager.notebookbar;
        if (notebookbar) {
            if (offered)
                notebookbar.showItem('insert-update-slide-links');
            else
                notebookbar.hideItem('insert-update-slide-links');
        }
        const menubar = this.map.menubar;
        if (menubar) {
            if (offered)
                menubar.showItem('updateslidelinks');
            else
                menubar.hideItem('updateslidelinks');
        }
    }
    enqueue(source, part) {
        this.queue.push({
            kind: 'pages',
            source: source,
            step: 'waiting',
            part: part,
            byIdentifier: false,
        });
        this.sendNext();
    }
    // The remote link a source names, as the storage announced it, or null when this
    // document links to no document of that name.
    remoteLink(source) {
        for (const doc of app.remoteLinks || []) {
            if (SlideImportSession.matchesDocument(doc, source))
                return doc;
        }
        return null;
    }
    // A source writes its pages out over the live link this document holds to it, so a source
    // nothing is linked to yet is subscribed to first and asked once it answers.
    sendNext() {
        if (this.running !== null)
            return;
        const next = this.queue.shift();
        if (next === undefined)
            return;
        // A section that lost its link while it waited, to an edit or to another
        // view, has nothing to be updated from.
        if (next.kind === 'section' && !this.sections.has(next.section)) {
            this.sendNext();
            return;
        }
        const remoteLink = this.remoteLink(next.source);
        if (!remoteLink) {
            this.say(_('{0} is not one of the documents this one is related to, so the server cannot read it.').replace('{0}', () => next.source));
            this.sendNext();
            return;
        }
        // A source this view holds no token for, one the storage could not give, or one no
        // remote link stands for, is never asked: a subscription to it would wait for ever.
        if (!SlideLinks.isReadable(remoteLink.state)) {
            this.abandonUnreadableSource(next, remoteLink.state);
            return;
        }
        this.running = next;
        if (remoteLink.state === 'connected')
            this.askForPages();
        else
            SlideImportSession.subscribeRemoteLink(next.source);
    }
    // A source that cannot be read leaves the run it was asked for. The user is told why the
    // source could not be read, and the next source in the queue goes.
    abandonUnreadableSource(refresh, state) {
        let message = _('{0} could not be read.');
        if (state === 'noaccess')
            message =
                refresh.kind === 'section'
                    ? _('You do not have access to {0}, so the section cannot be updated.')
                    : _('You do not have access to {0}, so its pages cannot be refreshed.');
        this.say(message.replace('{0}', () => refresh.source));
        this.sendNext();
    }
    // The source in hand is asked for the slides the pages of this document came from.
    askForPages() {
        const refresh = this.running;
        if (refresh === null)
            return;
        // A section update asks the source which slides the section holds now,
        // and the identifiers to ask for them by. The presentation info reports
        // both in one answer.
        if (refresh.kind === 'section') {
            refresh.step = 'info';
            SlideImportSession.sendRemoteCommand(refresh.source, 'getpresentationinfo');
            return;
        }
        refresh.step = 'export';
        const guids = this.sourceGuids(refresh.source, refresh.part);
        refresh.byIdentifier = guids !== null;
        SlideImportSession.sendRemoteCommand(refresh.source, guids === null ? 'exportslides' : 'exportslides guids=' + guids.join(','));
    }
    // The identifiers the pages linked to a source record for their slides, or null when a page
    // of that source records none or is read by the name of its slide. A refresh of one page
    // asks for the slide of that page alone.
    sourceGuids(source, part) {
        const guids = [];
        for (const [linkedPart, link] of this.pages) {
            if (link.source !== source)
                continue;
            if (part !== undefined && linkedPart !== part)
                continue;
            if (!link.sourceGuid || link.name)
                return null;
            guids.push(link.sourceGuid);
        }
        return guids.length > 0 ? guids : null;
    }
    // A source this run is waiting on has come up, so it is asked for its pages. A source
    // that became unreadable, or whose subscription was refused, ends the run instead,
    // so that the run leaves the queue and the sources behind it are still refreshed.
    // A source that went down after it was asked is asked again once it comes back up.
    onRemoteLinks() {
        this.readSourceSlides();
        app.events.fire('slidelink:changed', {});
        if (this.running === null || this.running.step === 'updating')
            return;
        const remoteLink = this.remoteLink(this.running.source);
        if (remoteLink && remoteLink.state === 'connected') {
            if (this.running.step === 'waiting')
                this.askForPages();
            return;
        }
        if (this.running.step !== 'waiting' &&
            remoteLink &&
            remoteLink.state === 'disconnected') {
            this.running.step = 'waiting';
            return;
        }
        if (remoteLink && remoteLink.state === 'subscribed')
            this.running.subscribed = true;
        // A subscription this run opened was refused so went back to "available" state
        const dead = this.running.step !== 'waiting' ||
            (remoteLink !== null &&
                remoteLink.state === 'available' &&
                this.running.subscribed === true);
        if (remoteLink && !dead && SlideLinks.isReadable(remoteLink.state))
            return;
        const refresh = this.running;
        this.running = null;
        this.abandonUnreadableSource(refresh, remoteLink ? remoteLink.state : '');
    }
    // The pages the source wrote, staged in this document's jail by the server. The document
    // reads the pages of that source from the file. The import pane may be reading another
    // document at the same time, so only the answers of the source in hand are taken.
    onRemoteResult(e) {
        const textMsg = e.textMsg || '';
        if (textMsg.startsWith('presentationinfo:')) {
            this.onSourceSlides(e.source || '', textMsg.substring('presentationinfo:'.length));
            return;
        }
        const refresh = this.running;
        if (refresh === null || refresh.step !== 'export')
            return;
        if (e.source && e.source !== refresh.source)
            return;
        if (!textMsg.startsWith('exportslides:'))
            return;
        const body = textMsg.substring('exportslides:'.length);
        const stagedName = SlideImportSession.stagedExportName(body);
        if (!stagedName) {
            this.running = null;
            const missing = refresh.kind === 'pages' &&
                refresh.byIdentifier &&
                SlideImportSession.exportFailureKind(body) === 'failed';
            this.say(missing
                ? _('Cannot update the slides of {0}: source lacks the matching slides').replace('{0}', () => refresh.source)
                : _('The slides of {0} could not be read into this presentation.').replace('{0}', () => refresh.source));
            this.sendNext();
            return;
        }
        // The pages read now match the source as it is, so they record the
        // source time the remote links list reports for it. A refresh of
        // one page names it, and the document leaves the other pages of the
        // source as they are.
        const current = this.currentSourceTime(refresh.source);
        refresh.step = 'updating';
        app.socket.sendMessage('slidelink update source=' +
            encodeURIComponent(refresh.source) +
            ' file=' +
            encodeURIComponent(stagedName) +
            (current ? ' time=' + encodeURIComponent(current) : '') +
            SlideLinks.refreshTarget(refresh));
    }
    // The tokens of an update command that name what the refresh reads: one
    // page, or a section and the name its source section has now. A refresh of
    // every page of the source names neither.
    static refreshTarget(refresh) {
        if (refresh.kind === 'pages')
            return refresh.part !== undefined ? ' part=' + refresh.part : '';
        return (' section=' +
            encodeURIComponent(refresh.section) +
            (refresh.sourceSectionName
                ? ' sectionname=' + encodeURIComponent(refresh.sourceSectionName)
                : ''));
    }
    // The section a refresh updates, or undefined for a refresh of pages.
    static sectionOf(refresh) {
        return refresh.kind === 'section' ? refresh.section : undefined;
    }
    // What the document made of the pages it was given.
    onUpdated(e) {
        const message = e.message;
        if (!message || message.status !== 'updated' || this.running === null)
            return;
        if (message.source !== this.running.source)
            return;
        if ((message.section || undefined) !== SlideLinks.sectionOf(this.running))
            return;
        const refresh = this.running;
        this.running = null;
        if (refresh.kind === 'section') {
            this.say(_('The section was updated from {0}.').replace('{0}', () => refresh.source));
            this.sendNext();
            return;
        }
        this.report({
            source: refresh.source,
            state: 'ok',
            slides: typeof message.count === 'number' ? message.count : 0,
        });
        this.sayNotUpdated(message.notUpdated);
        this.sendNext();
    }
    // Asks every source this document is connected to for the slides it holds
    readSourceSlides() {
        for (const source of this.linkedSources()) {
            const remoteLink = this.remoteLink(source);
            if (!remoteLink || remoteLink.state !== 'connected') {
                // A source that went down says nothing about its slides, so one that was
                // asked and did not answer is asked again once it comes up.
                const pending = this.sourceSlides.get(source);
                if (pending && pending.guids === null)
                    this.sourceSlides.delete(source);
                continue;
            }
            const time = remoteLink.lastModifiedTime || '';
            const known = this.sourceSlides.get(source);
            if (known && known.time === time)
                continue;
            this.sourceSlides.set(source, {
                time: time,
                guids: null,
                names: new Map(),
                sections: null,
            });
            SlideImportSession.sendRemoteCommand(source, 'getpresentationinfo');
        }
    }
    // The sources the document links to, by its pages or by its sections.
    linkedSources() {
        const sources = this.sources.slice();
        this.sections.forEach((link) => {
            if (sources.indexOf(link.source) < 0)
                sources.push(link.source);
        });
        return sources;
    }
    // The slides and the sections a source holds, as it reports them. Only a
    // source that was asked, or a section update waiting on it, takes them.
    onSourceSlides(source, json) {
        const refresh = this.awaitedSectionRefresh(source);
        const asked = this.sourceSlides.get(source);
        if (!refresh && !asked)
            return;
        const guids = new Set();
        const names = new Map();
        const parts = [];
        let sections;
        try {
            const info = JSON.parse(json);
            const slides = Array.isArray(info.slides) ? info.slides : [];
            for (const slide of slides) {
                if (slide && slide.guid) {
                    guids.add(slide.guid);
                    names.set(slide.guid, slide.name || _('Slide %1').replace('%1', String(slide.index + 1)));
                }
                parts.push(slide && slide.part ? String(slide.part) : '');
            }
            // A source with no sections reports none.
            sections = (Array.isArray(info.sections) ? info.sections : []).map((entry) => ({
                name: (entry && entry.name) || '',
                id: (entry && entry.id) || '',
                startIndex: (entry && entry.startIndex) || 0,
                slideCount: (entry && entry.slideCount) || 0,
            }));
        }
        catch {
            // A section update that waits on this answer has nothing to read the
            // slides of its section from.
            if (refresh)
                this.endSectionUpdate(refresh, _('{0} could not be read.'));
            return;
        }
        if (refresh)
            this.exportSection(refresh, sections, parts);
        if (!asked)
            return;
        this.sourceSlides.set(source, {
            time: asked.time,
            guids: guids,
            names: names,
            sections: new Set(sections.map((section) => section.id)),
        });
        app.events.fire('slidelink:changed', {});
    }
    // The section update in hand when it waits on what the given source
    // reports, or null.
    awaitedSectionRefresh(source) {
        const refresh = this.running;
        if (refresh === null ||
            refresh.kind !== 'section' ||
            refresh.step !== 'info' ||
            refresh.source !== source)
            return null;
        return refresh;
    }
    // A section update that cannot read the slides of its source section ends
    // with the given message, and the next refresh in the queue goes.
    endSectionUpdate(refresh, message) {
        if (this.running === refresh)
            this.running = null;
        this.say(message.replace('{0}', () => refresh.source));
        this.sendNext();
    }
    // Once the source reported its sections and the part identifier of each
    // of its slides in slide order, it is asked to write out the slides its
    // section holds now, in the order it holds them.
    exportSection(refresh, sourceSections, sourceParts) {
        const link = this.sections.get(refresh.section);
        const sourceSection = link
            ? sourceSections.find((section) => section.id === link.sourceSection)
            : undefined;
        const parts = sourceSection
            ? sourceParts.slice(sourceSection.startIndex, sourceSection.startIndex + sourceSection.slideCount)
            : [];
        if (!sourceSection || parts.length === 0 || parts.some((part) => !part)) {
            this.endSectionUpdate(refresh, _('Cannot update the section: {0} no longer holds its source section.'));
            app.events.fire('slidelink:changed', {});
            return;
        }
        // The section is asked for once, so a later answer of the source finds
        // nothing awaited.
        refresh.step = 'export';
        refresh.sourceSectionName = sourceSection.name;
        SlideImportSession.sendRemoteCommand(refresh.source, 'exportslides slides=' + parts.join(','));
    }
    // The slides a refresh left as they were not available.
    sayNotUpdated(notUpdated) {
        if (!Array.isArray(notUpdated) || notUpdated.length === 0)
            return;
        const numbers = notUpdated
            .filter((part) => typeof part === 'string')
            .map((part) => String(app.impress.getIndexFromPart(part) + 1));
        if (numbers.length === 0)
            return;
        this.say(_('Cannot update slide {0}: the source lacks matching slide').replace('{0}', () => numbers.join(', ')));
    }
    // An error ends the refresh in hand. An answer that names a page belongs to a break, and
    // one that names another source to a refresh of that source; the refresh in hand is
    // answered by an error that names it and by one that names nothing.
    onError(e) {
        window.app.console.warn('slidelink error of kind ' + (e.kind || ''));
        if (e.part) {
            // A page that is linked to nothing has nothing to take off, and the
            // toolbar of a slide that lost its link has gone already.
            if (e.kind !== 'notlinked')
                this.say(_('Unlinking the slide failed.'));
            return;
        }
        // A break of a section names the section and no source.
        if (e.section && !e.source) {
            if (e.kind !== 'notlinked')
                this.say(_('Unlinking the section failed.'));
            return;
        }
        if (this.running === null)
            return;
        if (e.source && e.source !== this.running.source)
            return;
        if (e.section && e.section !== SlideLinks.sectionOf(this.running))
            return;
        const refresh = this.running;
        this.running = null;
        // A page asked for on its own that another view refreshed or unlinked
        // meanwhile is linked to nothing the document knows, and is up to date.
        if (e.kind !== 'notlinked' ||
            refresh.kind === 'section' ||
            refresh.part === undefined)
            this.say((refresh.kind === 'section'
                ? _('Updating the section from {0} failed.')
                : _('Updating the slides of {0} failed.')).replace('{0}', () => refresh.source));
        this.sendNext();
    }
    // What a source came to, said to the user. Substitutions take a function,
    // which puts a name in as it is.
    report(entry) {
        if (entry.state === 'ok') {
            const count = typeof entry.slides === 'number' ? entry.slides : 0;
            if (count === 0)
                this.say(_('No slide of {0} was updated.').replace('{0}', () => entry.source));
            else if (count === 1)
                this.say(_('1 slide updated from {0}.').replace('{0}', () => entry.source));
            else
                this.say(_('{0} slides updated from {1}.')
                    .replace('{0}', String(count))
                    .replace('{1}', () => entry.source));
            return;
        }
        window.app.console.warn('The slides of ' +
            entry.source +
            ' were not updated: ' +
            (entry.reason || ''));
        this.say(this.failureText(entry));
    }
    failureText(entry) {
        switch (entry.reason) {
            case 'nosource':
                return _('{0} is not one of the documents this one is related to, so the server cannot read it.').replace('{0}', () => entry.source);
            case 'cantread':
                return _('{0} could not be read.').replace('{0}', () => entry.source);
            case 'unreadable':
                return _('The slides of {0} could not be read into this presentation.').replace('{0}', () => entry.source);
            case 'notlinked':
                return _('No slide of this presentation is linked to {0}.').replace('{0}', () => entry.source);
            case 'busy':
                return _('Another update is still running. Ask for {0} again in a moment.').replace('{0}', () => entry.source);
        }
        return _('Updating the slides of {0} failed.').replace('{0}', () => entry.source);
    }
}

// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
class SlideImportPane {
    constructor(map) {
        this.visible = false;
        // The sources on show, in the order the server lists them.
        this.sources = [];
        // Names the markup of the next source taken into the list.
        this.nextSourceId = 0;
        // The source the selection and the insert belong to, by key, or empty when
        // no slide is picked yet.
        this.activeKey = '';
        // What the reader typed into the filter, which appears once the list is
        // longer than a screenful.
        this.filterText = '';
        // The row to put at the top of the list after the next render, so a
        // reader who opens one source after another finds the same layout each
        // time: the row at the top and its slides below it.
        this.scrollRowToTop = '';
        // The slides picked in each source, by source key. An insert reads one
        // file, so the pane submits the active source's set and holds the rest:
        // moving between decks costs the reader nothing.
        this.picks = new Map();
        // Whether the pane has already opened a source of its own accord, which it
        // does for the first one of the list.
        this.openedFirstSource = false;
        // Whether the options show their controls or only the line that says what
        // they are set to. The reader's choice, kept for the session.
        this.optionsOpen = false;
        // Index of the slide frame that holds the roving tab stop, in the active
        // source's panel.
        this.focusIndex = 0;
        // Anchor slide for shift-click and shift-arrow range selection.
        this.anchorIndex = 0;
        // Index of the slide whose corner checkbox the primary button is pressed
        // on, or -1. The click handler reads it so a press that starts on the
        // checkbox toggles the slide even when the release lands beside it.
        this.pressedCheckboxIndex = -1;
        // Whether the pages this pane asked a source to write are still to come.
        this.awaitingExport = false;
        // Set while a drag start switches the pane over to another source.
        this.renderDeferred = false;
        this.map = map;
        this.session = new SlideImportSession(map);
        this.wrapper = document.getElementById('slide-import-dock-wrapper');
        this.panel = document.getElementById('slide-import-panel');
        app.events.on('slideimport:statechange', this.redraw.bind(this));
        app.events.on('slideimport:error', this.redraw.bind(this));
        app.events.on('slideimport:selection', this.onSelectionChanged.bind(this));
        app.events.on('slideimport:inserted', this.onInserted.bind(this));
        app.events.on('slideimport:exportwanted', this.onExportWanted.bind(this));
        app.events.on('slidelink:changed', this.redraw.bind(this));
        app.events.on('updatepermission', this.onUpdatePermission.bind(this));
        map.on('docloaded', this.onDocLoaded, this);
        map.on('remotelinks', this.onRemoteLinks, this);
        map.on('remotedoccommandresult', this.onRemoteResult, this);
        map.on('updateparts', this.updateInsertButton, this);
    }
    isVisible() {
        return this.visible;
    }
    open() {
        if (this.visible || !this.isAvailable())
            return;
        this.visible = true;
        this.wrapper.classList.add('visible');
        // A pane opened while the panels are maximized joins the grid layout
        // directly.
        this.setGridMode(this.map.paneExpander && this.map.paneExpander.getMode() === 'expanded');
        this.refreshSources();
        this.render();
    }
    close() {
        if (!this.visible)
            return;
        this.visible = false;
        if (this.map.paneExpander)
            this.map.paneExpander.onPanelClosing('slide-import-dock-wrapper');
        this.wrapper.classList.remove('visible');
        this.setGridMode(false);
        this.session.close();
        this.sources = [];
        this.activeKey = '';
        this.openedFirstSource = false;
        this.panel.replaceChildren();
    }
    // While the panels are maximized the thumbnails flow into a wider grid.
    // The class is the one the slide navigator's wrapper carries in that
    // state, so one set of grid rules lays out both panels. Only an open pane
    // takes it: the class forces the wrapper on show, so it would reveal a
    // closed pane.
    setGridMode(enabled) {
        this.wrapper.classList.toggle('parts-preview-grid', enabled && this.visible);
    }
    toggleExpand() {
        if (!this.map.paneExpander)
            return;
        this.map.paneExpander.toggle();
        // The pane offers different things at the two widths, so it is drawn
        // again rather than left with the controls of the layout it just left.
        if (this.visible)
            this.render();
    }
    toggle() {
        if (this.visible)
            this.close();
        else
            this.open();
    }
    isAvailable() {
        return (this.map.getDocType() === 'presentation' &&
            !window.mode.isSmallScreenDevice() &&
            this.map.isEditMode());
    }
    onUpdatePermission(e) {
        if (e.detail.perm !== 'edit')
            this.close();
    }
    onDocLoaded(e) {
        if (e.status === false)
            this.close();
    }
    // Something the pane shows changed: the state of the import, or the links
    // the source badges read.
    redraw() {
        if (this.renderDeferred || !this.visible)
            return;
        this.render();
    }
    onRemoteLinks() {
        if (!this.visible)
            return;
        this.refreshSources();
        this.render();
    }
    // The source the selection belongs to, or null while none is picked.
    activeSource() {
        return this.sources.find((source) => source.key === this.activeKey) || null;
    }
    isActive(source) {
        return source.key === this.activeKey && this.activeKey !== '';
    }
    findSource(persistentLink) {
        if (!persistentLink)
            return null;
        return (this.sources.find((source) => source.persistentLink === persistentLink) ||
            null);
    }
    // Takes the remote links the server announced into the source list,
    // keeping what the sources already answered. A source that is no longer
    // connected has to be asked again, so what it answered before is dropped.
    refreshSources() {
        const documents = app.remoteLinks || [];
        const kept = [];
        for (const doc of documents) {
            if (!doc.persistentLink)
                continue;
            const name = SlideImportSession.documentName(doc);
            const key = doc.persistentLink;
            let source = this.sources.find((known) => known.key === key);
            if (!source) {
                source = {
                    key: key,
                    id: this.nextSourceId++,
                    name: name,
                    persistentLink: doc.persistentLink,
                    access: doc.access || '',
                    state: doc.state,
                    error: doc.error || '',
                    expanded: false,
                    asked: false,
                    opening: false,
                    docWidth: 0,
                    docHeight: 0,
                    slideParts: [],
                    slides: [],
                    sections: [],
                    thumbnails: new Map(),
                    collapsedSections: new Set(),
                };
            }
            source.name = name;
            source.access = doc.access || '';
            source.state = doc.state;
            source.error = doc.error || '';
            // The source answered, so it is not opening any more.
            if (source.state !== 'available' && source.state !== 'disconnected')
                source.opening = false;
            if (source.state !== 'connected' && source.asked)
                this.forget(source);
            kept.push(source);
        }
        this.sources = kept;
        // A source that is gone takes its picks with it.
        for (const key of Array.from(this.picks.keys()))
            if (!this.sources.some((source) => source.key === key))
                this.picks.delete(key);
        const active = this.activeSource();
        // The export answer travels over the active source's connection, so an
        // export awaited while that connection is not up will never arrive.
        if (this.awaitingExport && (!active || active.state !== 'connected')) {
            this.awaitingExport = false;
            this.session.exportFailed();
        }
        // The selection belongs to a source that is gone, or to one the pane
        // cannot read any more; there is nothing left to insert. A source that
        // has not answered yet keeps its place, because opening it is what made
        // it the active one.
        if (this.activeKey && (!active || this.degraded(active))) {
            this.activeKey = '';
            this.session.close();
        }
        // The first source of a document opens on its own, so the pane shows
        // slides as soon as it is opened.
        if (!this.openedFirstSource && this.sources.length) {
            this.openedFirstSource = true;
            this.expandSource(this.sources[0]);
        }
        for (const source of this.sources)
            if (source.expanded || this.isActive(source))
                this.askSource(source);
    }
    // Drops what a source answered about its slides.
    forget(source) {
        source.asked = false;
        source.opening = false;
        source.docWidth = 0;
        source.docHeight = 0;
        source.slideParts = [];
        source.slides = [];
        source.sections = [];
        source.thumbnails.clear();
    }
    // Asks an open source for its slides: a source that is not connected yet is
    // subscribed to first, and the slides follow once it answers. A source
    // whose last subscription failed, or was refused, keeps that answer on
    // show until the user asks for the source again.
    askSource(source, again = false) {
        if (!this.canShowSlides(source))
            return;
        if (source.state === 'failed' && !again)
            return;
        if (source.state === 'connected') {
            if (source.asked)
                return;
            source.asked = true;
            this.sendRemoteCommand(source, 'getpresentationinfo');
            this.sendRemoteCommand(source, 'getslidesections');
            return;
        }
        if (source.state !== 'available' &&
            source.state !== 'disconnected' &&
            source.state !== 'failed')
            return;
        if (source.opening)
            return;
        source.opening = true;
        SlideImportSession.subscribeRemoteLink(source.persistentLink);
    }
    // One source shows its slides at a time, and the one on show is the one an
    // insert reads from. Collapsing it keeps it active, so a selection survives
    // hiding the slides it was made from.
    expandSource(source) {
        source.expanded = true;
        this.scrollRowToTop = source.key;
        if (this.degraded(source) || !this.canShowSlides(source))
            return;
        this.activate(source);
        this.askSource(source);
        // A source that answered before it was opened has its slides already,
        // and askSource answers once, so the pictures are asked for here.
        this.requestRemoteThumbnails(source);
    }
    toggleSource(source) {
        if (source.expanded)
            source.expanded = false;
        else
            this.expandSource(source);
        this.render();
        const row = this.panel.querySelector('.slide-import-source[data-key="' +
            CSS.escape(source.key) +
            '"] .slide-import-source-main');
        if (row)
            row.focus();
    }
    // Reads a source's slides again, so a file that changed shows what it holds
    // now.
    reloadSource(source) {
        this.forget(source);
        if (this.isActive(source)) {
            this.session.slideCount = 0;
            this.session.clearSelection();
        }
        this.askSource(source, true);
        this.render();
    }
    // Makes a source the one the selection and the insert belong to. The
    // selection of the source left behind is dropped: an insert reads its
    // slides out of a single file.
    activate(source) {
        if (this.isActive(source))
            return;
        const leaving = this.activeSource();
        if (leaving)
            this.picks.set(leaving.key, new Set(this.session.selection));
        this.activeKey = source.key;
        this.focusIndex = 0;
        this.anchorIndex = 0;
        const kept = this.picks.get(source.key);
        this.session.setSelection(kept ? Array.from(kept) : []);
        this.session.slideCount = source.slides.length;
        // The pages of a link insert record the persistent link of the document
        // they came from. A source without one cannot be linked to.
        this.session.setSource(source.persistentLink);
        if (source.slides.length)
            this.session.slidesShown();
    }
    // The "Add presentation…" button asks the integration to open its own
    // file chooser, filtered to presentations, and to add the picked file as a
    // permanent link. The integration registers it with a POST to
    // /cool/links using the one-time token below. The added file then
    // arrives in the remote links list, from where its slides are
    // imported. Locating a missing source names that source too, so the
    // integration binds the picked file to the pages that store it.
    browseForImport(source) {
        if (!app.linkToken)
            return;
        const args = {
            Nonce: app.linkToken,
            WOPISrc: window.wopiSrc,
            Endpoint: window.makeHttpUrl('/cool/links') +
                '?WOPISrc=' +
                encodeURIComponent(window.wopiSrc),
            MimeTypeFilter: app.LOUtil.presentationMimeFilter,
        };
        if (source)
            args.PersistentLink = source.persistentLink;
        app.map.fire('postMessage', {
            msgId: 'UI_GetPermanentLink',
            args: args,
        });
    }
    // "Remove from list" drops a file from the remote links of this one, for
    // every view. The integration is notified, so a storage that
    // keeps the list drops the link too.
    removeFromList(source) {
        if (!source.persistentLink)
            return;
        SlideImportSession.removeRemoteLink(source.persistentLink);
        app.map.fire('postMessage', {
            msgId: 'UI_RemovePermanentLink',
            args: {
                WOPISrc: window.wopiSrc,
                Link: {
                    PersistentLink: source.persistentLink,
                    BaseFileName: source.name,
                },
            },
        });
    }
    // Sends a read-only client command to a subscribed source. Its reply
    // arrives as a remotedoccommandresult map event carrying the same source.
    sendRemoteCommand(source, inner) {
        SlideImportSession.sendRemoteCommand(source.persistentLink, inner);
    }
    // A reply from one of the sources the pane shows.
    onRemoteResult(e) {
        const source = this.findSource(e.source);
        if (!source)
            return;
        // An answer that arrives after the link failed belongs to the slides
        // the source showed before, which the pane has dropped. The pane shows
        // why the source cannot be read, and takes slides from it again once
        // it connects again.
        if (source.state !== 'connected')
            return;
        const textMsg = e.textMsg || '';
        if (textMsg.startsWith('presentationinfo:')) {
            this.onRemotePresentationInfo(source, textMsg.substring('presentationinfo:'.length));
        }
        else if (textMsg.startsWith('slidesections:')) {
            this.onRemoteSlideSections(source, textMsg.substring('slidesections:'.length));
        }
        else if (textMsg.startsWith('tile:')) {
            this.onRemoteThumbnail(source, textMsg, e.imgBytes, e.imgIndex ?? 0);
        }
        else if (textMsg.startsWith('exportslides:') && this.isActive(source)) {
            // Only the source an insert takes its slides from writes them out for
            // this pane.
            this.onRemoteExport(textMsg.substring('exportslides:'.length));
        }
    }
    // The slides a user chose are written out by the source as a presentation
    // of their own. The server stages it in this document's jail and names it
    // here, and the insert takes that file.
    onExportWanted() {
        const insert = this.session.getPendingInsert();
        if (!insert)
            return;
        const source = this.activeSource();
        if (!source) {
            this.session.exportFailed();
            return;
        }
        const parts = insert.slides
            .map((index) => source.slideParts[index])
            .filter((part) => !!part);
        if (!parts.length) {
            this.session.exportFailed();
            return;
        }
        // Update Linked Slides asks the same document for its pages, so only the
        // export this pane asked for is taken as the file an insert reads.
        this.awaitingExport = true;
        this.sendRemoteCommand(source, 'exportslides slides=' + parts.join(','));
    }
    onRemoteExport(json) {
        if (!this.awaitingExport)
            return;
        this.awaitingExport = false;
        const insert = this.session.getPendingInsert();
        if (!insert)
            return;
        const stagedName = SlideImportSession.stagedExportName(json);
        if (!stagedName) {
            this.session.exportFailed();
            return;
        }
        const source = this.activeSource();
        this.session.insertStaged(stagedName, insert.at, source && this.session.insertAsSection
            ? this.wholeSectionOf(source, insert.slides)
            : null);
    }
    // The section of the source that the given slides make up, every slide of
    // it in order and no other slide, when they can go in as that section, or
    // null. A slide linked by position belongs to no section of the source, so
    // such slides go in as slides.
    wholeSectionOf(source, slides) {
        const session = this.session;
        if (session.linkToSource && session.canLink && session.linkByPosition)
            return null;
        if (slides.length === 0)
            return null;
        const section = this.sectionOf(source, slides[0]);
        if (!section || !section.id || section.startIndex !== slides[0])
            return null;
        if (section.slideCount !== slides.length)
            return null;
        for (let i = 0; i < slides.length; i++)
            if (slides[i] !== section.startIndex + i)
                return null;
        return section;
    }
    onRemotePresentationInfo(source, json) {
        try {
            const info = JSON.parse(json);
            source.docWidth = info.docWidth || 0;
            source.docHeight = info.docHeight || 0;
            const slides = Array.isArray(info.slides) ? info.slides : [];
            source.slideParts = slides.map((s) => typeof s.part === 'string' ? s.part : '');
            source.slides = slides.map((s, index) => ({
                index: index,
                name: typeof s.name === 'string' ? s.name : '',
                guid: s.guid || '',
            }));
        }
        catch (err) {
            app.console.error('Bad remote presentationinfo: ' + err);
            return;
        }
        // The link updates ask the same source for its presentation info, and an
        // answer that reaches the pane while it inserts leaves the insert running.
        if (this.isActive(source) && this.session.state !== 'inserting') {
            this.session.slideCount = source.slides.length;
            // The slides are on show, so they can be chosen and inserted.
            this.session.slidesShown();
        }
        this.requestRemoteThumbnails(source);
        if (this.visible)
            this.render();
    }
    onRemoteSlideSections(source, json) {
        try {
            const sections = JSON.parse(json);
            source.sections = Array.isArray(sections)
                ? sections.map((s) => ({
                    name: s.name || '',
                    id: s.id || '',
                    startIndex: s.startIndex || 0,
                    slideCount: s.slideCount || 0,
                }))
                : [];
        }
        catch (err) {
            app.console.error('Bad remote slidesections: ' + err);
            return;
        }
        if (this.visible)
            this.render();
    }
    // Asks a source for a picture of every slide, fitted to the pane width,
    // keyed by slot so each reply lands in its frame.
    requestRemoteThumbnails(source) {
        if (source.slideParts.length <= 0 ||
            source.docWidth <= 0 ||
            source.docHeight <= 0)
            return;
        const targetWidth = 160;
        const targetHeight = Math.max(1, Math.round((targetWidth * source.docHeight) / source.docWidth));
        const scale = app.roundedDpiScale || 1;
        for (let slot = 0; slot < source.slideParts.length; ++slot) {
            // The request names the slide by its part identifier, which the source
            // resolves to the page it paints. The slot index rides along as the
            // preview id: it is a non-negative integer, so the source treats the
            // request as a preview and echoes the id back, which lands the reply in
            // the right thumbnail slot.
            const partId = source.slideParts[slot];
            if (!partId)
                continue;
            this.sendRemoteCommand(source, 'tile nviewid=0 part=' +
                partId +
                ' mode=0 width=' +
                Math.round(targetWidth * scale) +
                ' height=' +
                Math.round(targetHeight * scale) +
                ' tileposx=0 tileposy=0 tilewidth=' +
                source.docWidth +
                ' tileheight=' +
                source.docHeight +
                ' id=' +
                slot);
        }
    }
    onRemoteThumbnail(source, textMsg, imgBytes, imgIndex) {
        if (!imgBytes)
            return;
        // A preview tile echoes its slot index as the integer id. A tile with
        // no id is not one of our thumbnails.
        const id = new ServerCommand(textMsg, this.map).id;
        if (id === undefined || id === '')
            return;
        const slot = parseInt(id, 10);
        if (isNaN(slot) || slot < 0 || slot >= source.slideParts.length)
            return;
        source.thumbnails.set(slot, {
            url: app.socket.pngDataUrl(imgBytes.subarray(imgIndex)),
            width: source.docWidth,
            height: source.docHeight,
        });
        // The slide frames already exist from the presentation info, so drop the
        // arrived thumbnail into its slot without rebuilding the list.
        this.updateThumbnail(source, slot);
    }
    // The source the pages of this document are linked to, when the given
    // source is one of them, and an empty string otherwise.
    linkedSource(source) {
        const links = this.map.slideLinks;
        if (!links)
            return '';
        return links.linkedSourceOf({ persistentLink: source.persistentLink });
    }
    // What the pane says of a source: whether pages of this document are
    // linked to it, and when it cannot be reached, why. A linked source shows
    // the icon that the link badge on its slides shows, and red is kept for a
    // source that cannot be reached.
    sourceBadge(source) {
        if (source.opening)
            return { kind: 'checking', label: _('Checking...') };
        if (source.state === 'missing')
            return { kind: 'missing', label: _('Missing') };
        if (source.state === 'noaccess')
            return { kind: 'missing', label: _('No access') };
        if (source.state === 'failed')
            return { kind: 'missing', label: _('Could not open') };
        if (this.linkedSource(source)) {
            const changed = this.outdatedCount(source);
            if (changed)
                return {
                    kind: 'outdated',
                    label: _('{0} changed').replace('{0}', String(changed)),
                };
            if (source.state === 'disconnected')
                return { kind: 'disconnected', label: _('Disconnected') };
            return { kind: 'linked', label: _('Linked') };
        }
        if (!source.asked)
            return { kind: 'unchecked', label: _('Not checked') };
        return { kind: 'unlinked', label: _('Not linked') };
    }
    // How many pages linked to this source report the source as changed.
    outdatedCount(source) {
        const links = this.map.slideLinks;
        const linked = this.linkedSource(source);
        if (!links || !linked)
            return 0;
        return links.countOutdatedPagesFrom(linked);
    }
    // How many slides are picked in a source the insert is not reading from.
    // The active source's count is on the Insert btn, where it drives
    // something, so the row says nothing about it.
    pickedCount(source) {
        if (this.isActive(source))
            return 0;
        const kept = this.picks.get(source.key);
        return kept ? kept.size : 0;
    }
    // How many pages this document already took from a source. A plain copy
    // records no source, so the count speaks for linked pages alone and says
    // nothing at all when there are none.
    takenCount(source) {
        const links = this.map.slideLinks;
        const linked = this.linkedSource(source);
        if (!links || !linked)
            return 0;
        return links.countPagesFrom(linked);
    }
    // A state that shows no slides and will not start showing them by waiting.
    degraded(source) {
        return (source.state === 'missing' ||
            source.state === 'noaccess' ||
            source.state === 'failed');
    }
    // Why a source shows no slides, or an empty string when it shows some. The
    // chip names the state; this says what the chip has no room to say.
    sourceMessage(source) {
        if (source.slides.length)
            return '';
        if (source.opening)
            return _('Reading the slides...');
        if (source.state === 'missing') {
            if (source.access === 'pending')
                return _('Looking for the file...');
            if (source.access === 'denied')
                return _('The slides are in this presentation. You do not have permission to open the file they came from.');
            if (source.access === 'failed')
                return _('The slides are in this presentation. Looking for the file they came from did not work this time.');
            return _("Original file can't be found. Choose it again to keep your slides up to date.");
        }
        if (source.state === 'noaccess')
            return _('This file is here. You do not have permission to open it.');
        if (source.state === 'failed' && source.error === 'cycledetected')
            return _('Slides cannot be linked from this file: the link would lead back to this presentation.');
        if (source.state === 'failed')
            return _('This file could not be read this time.');
        return _('Reading the slides...');
    }
    sourceRecovery(source) {
        if (source.state === 'missing') {
            const actions = [
                {
                    text: _('Choose file…'),
                    icon: 'choose',
                    enabled: !!app.linkToken,
                    run: () => this.browseForImport(source),
                },
            ];
            if (this.canLookAgain(source))
                actions.push({
                    text: _('Try again'),
                    icon: 'retry',
                    enabled: true,
                    run: () => this.lookAgain(source),
                });
            return actions;
        }
        // A link that would lead back to this presentation is refused every
        // time, so there is nothing to try again.
        if (source.state === 'failed' && source.error !== 'cycledetected')
            return [
                {
                    text: _('Reload slides'),
                    enabled: true,
                    run: () => this.reloadSource(source),
                },
            ];
        return [];
    }
    canLookAgain(source) {
        return (source.state === 'missing' &&
            source.persistentLink !== '' &&
            source.access !== '' &&
            source.access !== 'pending' &&
            source.access !== 'resolved');
    }
    lookAgain(source) {
        if (!this.canLookAgain(source))
            return;
        SlideImportSession.resolveRemoteLink(source.persistentLink);
    }
    onSelectionChanged() {
        if (!this.visible)
            return;
        const source = this.activeSource();
        const list = source ? this.slideList(source) : null;
        if (list && source) {
            list
                .querySelectorAll('.slide-import-slide')
                .forEach((option) => {
                const index = parseInt(option.dataset.index, 10);
                const selected = this.session.selection.has(index);
                option.setAttribute('aria-selected', selected ? 'true' : 'false');
                const img = option.querySelector('.preview-img');
                if (img)
                    img.classList.toggle('preview-img-selectedpart', selected);
                const checkbox = option.querySelector('.slide-import-checkbox');
                if (checkbox)
                    checkbox.classList.toggle('checked', selected);
            });
            this.updateSectionSelection(source);
        }
        this.updateInsertButton();
    }
    slideList(source) {
        return this.panel.querySelector('.slide-import-list[data-source-id="' + source.id + '"]');
    }
    // Drops the thumbnail that arrived for a slide into its frame, replacing
    // the skeleton, without rebuilding the list.
    updateThumbnail(source, index) {
        if (!this.visible)
            return;
        const list = this.slideList(source);
        const thumbnail = source.thumbnails.get(index);
        if (!list || !thumbnail)
            return;
        const option = list.querySelector('.slide-import-slide[data-index="' + index + '"]');
        if (!option)
            return;
        const img = option.querySelector('.preview-img');
        if (!img)
            return;
        img.src = thumbnail.url;
        img.classList.remove('slide-import-skeleton');
    }
    onInserted(e) {
        const count = e.detail.count;
        const label = count === 1
            ? _('1 slide inserted')
            : _('{0} slides inserted').replace('{0}', String(count));
        this.map.uiManager.showSnackbar(label);
    }
    slideLabel(source, index) {
        const slide = source.slides[index];
        const name = slide && slide.name ? slide.name : '';
        return name ? name : _('Slide {0}').replace('{0}', String(index + 1));
    }
    insertButtonLabel() {
        const count = this.session.selection.size;
        if (!count)
            return _('Insert slides');
        const section = this.pickedSection();
        if (section && this.session.insertAsSection)
            return _('Insert section "{0}"').replace('{0}', () => section.name);
        // With several decks open more than one may hold picks, so the button
        // names the file whose picks it will send.
        const elsewhere = Array.from(this.picks.entries()).some(([key, set]) => key !== this.activeKey && set.size);
        const active = this.activeSource();
        if (active && elsewhere)
            return _('Insert {0} from {1}')
                .replace('{0}', String(count))
                .replace('{1}', active.name);
        if (count === 1)
            return _('Insert 1 slide');
        return _('Insert {0} slides').replace('{0}', String(count));
    }
    updateInsertButton() {
        const button = this.panel.querySelector('.slide-import-insert');
        if (!button)
            return;
        const lands = this.insertLandsText();
        button.textContent = this.insertButtonLabel();
        button.dataset.cooltip = lands;
        button.setAttribute('aria-description', lands);
        button.disabled =
            this.session.selection.size === 0 || this.session.state !== 'ready';
        // The choice is drawn afresh, and a radio of it that held the focus hands
        // the focus to the one drawn in its place.
        const choice = this.panel.querySelector('.slide-import-section-choice');
        if (choice) {
            const focused = choice.contains(document.activeElement) && document.activeElement
                ? document.activeElement.id
                : '';
            const redrawn = this.renderSectionChoice();
            choice.replaceWith(redrawn);
            if (focused) {
                const radio = redrawn.querySelector('#' + focused);
                if (radio)
                    radio.focus();
            }
        }
    }
    // The section of the active source that the picks make up, all of it and
    // nothing else, when it can go in as a section.
    pickedSection() {
        const source = this.activeSource();
        if (!source)
            return null;
        const slides = Array.from(this.session.selection).sort((a, b) => a - b);
        return this.wholeSectionOf(source, slides);
    }
    // Whether picks that make up a whole section go in as that section or as
    // separate slides, offered only while the picks make up a whole section. A
    // linked section follows its source section, which the line under the
    // choice says.
    renderSectionChoice() {
        const session = this.session;
        const section = this.pickedSection();
        const linked = session.linkToSource && session.canLink;
        const source = this.activeSource();
        const choice = (h("div", { class: "slide-import-section-choice", role: "radiogroup", "aria-label": _('How the section goes in') },
            section &&
                this.renderSectionChoiceOption('section', _('Insert as section "{0}"').replace('{0}', () => section.name), true),
            section &&
                this.renderSectionChoiceOption('slides', _('Insert as separate slides'), false),
            section && session.insertAsSection && linked && (h("span", { class: "slide-import-section-choice-note" }, _('Linked to its section in {0}. Update Links brings in later changes.').replace('{0}', () => (source ? source.name : session.fileName))))));
        choice.hidden = !section;
        return choice;
    }
    renderSectionChoiceOption(key, label, asSection) {
        const id = 'slide-import-section-choice-' + key;
        return (h("div", { class: "radiobutton ui-radiobutton jsdialog" },
            h("input", { type: "radio", id: id, name: "slide-import-section-choice", checked: this.session.insertAsSection === asSection, onChange: () => {
                    this.session.setInsertAsSection(asSection);
                    this.updateInsertButton();
                } }),
            h("label", { for: id }, label)));
    }
    updateLinkMode() {
        const group = this.panel.querySelector('.slide-import-linkmode');
        if (group)
            group.hidden = !(this.session.linkToSource && this.session.canLink);
    }
    // How many slides a source holds, and how many of them are picked.
    slideCountText(source) {
        const count = source.slides.length;
        if (!count)
            return '';
        const taken = this.takenCount(source);
        // A row 342px wide holds the name, the chip and the menu btn first, so
        // the short form is what fits.
        if (taken)
            return _('{0} of {1}')
                .replace('{0}', String(taken))
                .replace('{1}', String(count));
        return _('{0} slides').replace('{0}', String(count));
    }
    // Where the slides will go, which the slide sorter decides and the pane
    // only reports.
    insertLandsText() {
        const after = this.session.insertAfter();
        if (!after)
            return _('Inserts at the end');
        return _('Inserts after slide {0}').replace('{0}', String(after));
    }
    statusText() {
        if (this.session.state === 'opening')
            return _('Opening file...');
        if (this.session.state === 'inserting')
            return _('Inserting slides...');
        return '';
    }
    render() {
        const list = this.panel.querySelector('.slide-import-source-list');
        const scrollTop = list ? list.scrollTop : 0;
        const active = this.activeSource();
        const slideCount = active ? active.slides.length : 0;
        if (this.focusIndex >= slideCount)
            this.focusIndex = 0;
        if (this.anchorIndex >= slideCount)
            this.anchorIndex = 0;
        this.panel.replaceChildren(h("div", { class: "slide-import" },
            this.renderHeader(),
            this.sources.length ? this.renderBody() : this.renderEmptyState()));
        this.panel
            .querySelectorAll('.navigation-expand-button, .close-navigation-button, .slide-import-insert, .slide-import-slide, .slide-import-linksource[data-cooltip]')
            .forEach((el) => window.L.control.attachTooltipEventListener(el, this.map));
        this.panel
            .querySelectorAll('.slide-import-source-name')
            .forEach((element) => app.layoutingService.onDrain(() => {
            const name = element;
            if (name.scrollWidth <= name.clientWidth)
                return;
            name.dataset.cooltip = name.innerText;
            window.L.control.attachTooltipEventListener(name, this.map);
        }));
        const newList = this.panel.querySelector('.slide-import-source-list');
        if (newList) {
            const row = this.scrollRowToTop
                ? newList.querySelector('.slide-import-source[data-key="' +
                    CSS.escape(this.scrollRowToTop) +
                    '"]')
                : null;
            const wanted = row
                ? newList.scrollTop +
                    (row.getBoundingClientRect().top -
                        newList.getBoundingClientRect().top)
                : scrollTop;
            const furthest = Math.max(0, newList.scrollHeight - newList.clientHeight);
            newList.scrollTop = Math.min(wanted, furthest);
            // The slides of the source arrive after the click, so the list is
            // still too short to put its row at the top. Keep asking until the
            // grid below it makes the room.
            if (!row || wanted <= furthest)
                this.scrollRowToTop = '';
        }
    }
    // The header carries the slide navigator's header classes, so both panels
    // share one set of header, title and button styles.
    renderHeader() {
        // The rebuilt button carries the state of the layout in hand, the one
        // the expander sets on every toggle.
        const expanded = this.map.paneExpander && this.map.paneExpander.getMode() === 'expanded';
        const expandButton = (h("button", { class: "navigation-expand-button slide-import-expand", onClick: () => this.toggleExpand() },
            h("img", { alt: "" })));
        PaneExpander.setToggleState(expandButton, expanded);
        return (h("div", { class: "navigation-header" },
            h("h2", { class: "navigation-title slide-import-title" }, _('Import slides')),
            expandButton,
            h("div", { class: "close-navigation-wrapper" },
                h("button", { class: "close-navigation-button slide-import-close", "aria-label": _('Close slide import'), "data-cooltip": _('Close slide import'), onClick: () => this.close() }))));
    }
    renderAddButton(className) {
        return (h("button", { class: className, disabled: !app.linkToken, onClick: () => this.browseForImport() }, _('Add presentation…')));
    }
    // What a document with no presentation to import from shows: an invitation
    // to add one.
    renderEmptyState() {
        return (h("div", { class: "slide-import-empty" },
            h("div", { class: "slide-import-empty-box" },
                h("span", { class: "slide-import-empty-icon", "aria-hidden": "true" },
                    h("img", { src: app.LOUtil.getImageURL('slide-deck-large.svg'), alt: "" })),
                h("div", { class: "slide-import-empty-title" }, _('No presentations yet')),
                h("div", { class: "slide-import-empty-text" }, _('Add a presentation to browse its slides and insert them into this deck.')),
                this.renderAddButton('button slide-import-add'))));
    }
    // Above eight sources the roster is longer than the pane, so finding a
    // speaker becomes its own task.
    static { this.filterFrom = 8; }
    shownSources() {
        const text = this.filterText.trim().toLowerCase();
        if (!text)
            return this.sources;
        return this.sources.filter((source) => source.name.toLowerCase().includes(text));
    }
    // Several decks stay open at once, so the reader needs one gesture for
    // the whole roster and one for the whole lot of slides. Only the expanded
    // pane offers it: at 384px one deck is already taller than the pane, so
    // opening every deck there is not somewhere to send anybody.
    renderShowAll() {
        if (this.sources.length < 2 || !this.paneExpanded())
            return null;
        const anyOpen = this.sources.some((source) => source.expanded);
        return (h("button", { class: "ui-linkbutton slide-import-show-all", onClick: () => this.toggleAll(!anyOpen) }, anyOpen ? _('Hide all slides') : _('Show all slides')));
    }
    toggleAll(open) {
        for (const source of this.sources) {
            source.expanded = open;
            if (source.expanded)
                this.askSource(source);
        }
        // The active source stays the one it was, so the accent, the picks and
        // the Insert btn do not move when the slides come and go.
        this.render();
        if (open)
            for (const source of this.sources)
                if (source.expanded)
                    this.requestRemoteThumbnails(source);
    }
    paneExpanded() {
        return !!(this.map.paneExpander && this.map.paneExpander.getMode() === 'expanded');
    }
    renderFilter() {
        if (this.sources.length <= SlideImportPane.filterFrom)
            return null;
        return (h("div", { class: "slide-import-filter" },
            h("input", { type: "text", class: "slide-import-filter-input", value: this.filterText, placeholder: _('Filter presentations'), "aria-label": _('Filter presentations'), onInput: (e) => {
                    this.filterText = e.target.value;
                    this.render();
                    const box = this.panel.querySelector('.slide-import-filter-input');
                    if (box) {
                        box.focus();
                        box.setSelectionRange(box.value.length, box.value.length);
                    }
                }, onKeyDown: (e) => {
                    if (e.key !== 'Escape' || !this.filterText)
                        return;
                    this.filterText = '';
                    this.render();
                } })));
    }
    renderBody() {
        const session = this.session;
        const status = this.statusText();
        return (h("div", { class: "slide-import-body" },
            h("div", { class: "slide-import-sources" },
                h("div", { class: "slide-import-sources-title" }, _('Slide sources')),
                h("span", { class: "slide-import-sources-actions" },
                    this.renderShowAll(),
                    this.renderAddButton('ui-linkbutton slide-import-add-link')),
                this.renderFilter(),
                h("ul", { class: "slide-import-source-list", "aria-label": _('Presentations to import from') }, this.shownSources().map((source) => this.renderSourceRow(source)))),
            h("div", { class: "slide-import-status", role: "status", "aria-live": "polite", style: { display: status ? '' : 'none' } }, status),
            session.error && (h("div", { class: "slide-import-error", role: "alert" },
                h("span", null, session.error.message),
                session.error.retry && (h("button", { class: "button slide-import-retry", onClick: () => session.error.retry() }, _('Retry'))))),
            this.renderOptions(),
            this.renderSectionChoice(),
            h("div", { class: "slide-import-footer" },
                h("button", { class: "button button-primary slide-import-insert", "data-cooltip": this.insertLandsText(), "aria-description": this.insertLandsText(), disabled: session.selection.size === 0 || session.state !== 'ready', onClick: () => session.insertSelected() }, this.insertButtonLabel()))));
    }
    // Whether the pane can read the slides of a source. A missing source, one
    // the storage could not give or one no remote link stands for, cannot be
    // reached at all.
    canShowSlides(source) {
        return source.state !== 'missing';
    }
    // One row of the source list: the file, what the pane says of it, and the
    // menu of what can be done with it. The file is a button while there are
    // slides to show or hide, and the reason it has none when it has none.
    renderSourceRow(source) {
        const badge = this.sourceBadge(source);
        const panelId = 'slide-import-panel-' + source.id;
        const chip = (h("span", { class: 'slide-import-source-badge ' + badge.kind },
            h("span", { class: "slide-import-source-badge-icon", "aria-hidden": "true" }),
            badge.label));
        const inside = [
            h("span", { class: "slide-import-source-chevron", "aria-hidden": "true" }),
            h("span", { class: "slide-import-source-name" }, source.name),
            h("span", { class: "slide-import-source-count" }, this.slideCountText(source)),
            this.pickedCount(source) ? (h("span", { class: "slide-import-source-picked" }, _('{0} picked').replace('{0}', String(this.pickedCount(source))))) : (''),
            chip,
        ];
        return (h("li", { class: 'slide-import-source' +
                (source.expanded ? ' expanded' : '') +
                (this.isActive(source) ? ' active' : ''), "data-state": source.state, "data-key": source.key },
            h("div", { class: "slide-import-source-row" },
                h("button", { class: "slide-import-source-main", "aria-expanded": source.expanded ? 'true' : 'false', "aria-controls": panelId, "aria-describedby": this.degraded(source)
                        ? 'slide-import-why-' + source.id
                        : undefined, onClick: () => this.toggleSource(source) }, inside),
                this.degraded(source) && (h("span", { class: "visuallyhidden", id: 'slide-import-why-' + source.id }, this.sourceMessage(source))),
                source.state !== 'missing' && (h("button", { class: "slide-import-source-menu", "aria-label": _('Actions for {0}').replace('{0}', source.name), "aria-haspopup": "true", onClick: (e) => this.openSourceMenu(e, source) }))),
            h("div", { id: panelId, class: "slide-import-source-panel", role: "region", "aria-label": source.name, "data-source-id": source.id }, source.expanded && this.renderPanelBody(source))));
    }
    openSourceMenu(e, source) {
        const entries = [];
        entries.push({
            id: 'toggle',
            type: 'comboboxentry',
            text: source.expanded ? _('Hide slides') : _('Show slides'),
        });
        // Reading the slides again also reaches a file that is not open yet, or
        // whose last read failed, so that is the way back from either.
        if (this.canShowSlides(source))
            entries.push({
                id: 'reload',
                type: 'comboboxentry',
                text: _('Reload slides'),
            });
        if (source.slides.length)
            entries.push({
                id: 'selectall',
                type: 'comboboxentry',
                text: _('Select all slides'),
            });
        const linked = this.linkedSource(source);
        if (linked)
            entries.push({
                id: 'update',
                type: 'comboboxentry',
                text: _('Update the slides linked to this file'),
            });
        if (!linked && source.persistentLink)
            entries.push({
                id: 'remove',
                type: 'comboboxentry',
                text: _('Remove from list'),
            });
        this.showSourceMenu(e, entries, source);
    }
    showSourceMenu(e, entries, source) {
        const linked = this.linkedSource(source);
        const callback = (objectType, eventType, object, data, entry) => {
            if (eventType !== 'selected')
                return false;
            switch (entry.id) {
                case 'toggle':
                    this.toggleSource(source);
                    break;
                case 'reload':
                    this.reloadSource(source);
                    break;
                case 'selectall':
                    this.activate(source);
                    this.session.setSelection(source.slides.map((slide) => slide.index));
                    break;
                case 'update':
                    this.map.slideLinks.updateSource(linked);
                    break;
                case 'remove':
                    this.removeFromList(source);
                    break;
            }
            JSDialog.CloseAllDropdowns();
            return true;
        };
        JSDialog.OpenDropdown('slide-import-source-menu', e.currentTarget, entries, callback, '', false, false, true);
    }
    // One source's slides under an expander, so several presentations are
    // browsed one after another without losing sight of the others.
    renderPanelBody(source) {
        const message = this.sourceMessage(source);
        if (message) {
            const recovery = this.sourceRecovery(source).filter((action) => action.enabled);
            return (h("div", { class: "slide-import-panel-message" },
                h("p", null, message),
                recovery.length > 0 && (h("div", { class: "slide-import-panel-actions" }, recovery.map((action) => (h("button", { class: 'button slide-import-panel-action' +
                        (action.icon ? ' ' + action.icon : ''), onClick: () => action.run() }, action.text)))))));
        }
        return (h("div", { class: "slide-import-list", role: "listbox", "aria-multiselectable": "true", "data-source-id": source.id, "aria-label": _('Slides in {0}').replace('{0}', source.name), onKeyDown: (e) => this.onListKeyDown(e, source) }, this.renderListItems(source)));
    }
    // What the options are set to, for the line that stands in for them while
    // they are closed. A setting left at its default is not named, so the line
    // says what someone chose and nothing else.
    optionsSummary() {
        const session = this.session;
        const parts = [];
        if (session.keepDesign)
            parts.push(_('Original design'));
        if (!session.linkToSource || !session.canLink)
            parts.push(_('Not linked'));
        else if (session.linkByPosition)
            parts.push(_('Linked, follows the slide number'));
        else
            parts.push(_('Linked, follows the slide'));
        return parts.join(' \u00b7 ');
    }
    updateOptionsSummary() {
        const state = this.panel.querySelector('.slide-import-options-state');
        if (state)
            state.textContent = this.optionsSummary();
    }
    toggleOptions() {
        this.optionsOpen = !this.optionsOpen;
        const summary = this.panel.querySelector('.slide-import-options-summary');
        const body = this.panel.querySelector('.slide-import-options-body');
        if (summary)
            summary.setAttribute('aria-expanded', String(this.optionsOpen));
        if (body)
            body.hidden = !this.optionsOpen;
    }
    renderOptions() {
        const session = this.session;
        const body = (h("div", { class: "slide-import-options-body", id: "slide-import-options-body" },
            h("label", { class: "slide-import-keepdesign" },
                h("input", { type: "checkbox", checked: session.keepDesign, onChange: (e) => {
                        session.setKeepDesign(e.target.checked);
                        this.updateOptionsSummary();
                    } }),
                _('Keep original design')),
            h("label", { class: "slide-import-linksource", "data-cooltip": session.formatKeepsLinks()
                    ? undefined
                    : _('Not supported in PPTX, please save as ODP to use links') },
                h("input", { type: "checkbox", checked: session.linkToSource, disabled: !session.canLink, onChange: (e) => {
                        session.setLinkToSource(e.target.checked);
                        this.updateLinkMode();
                        this.updateOptionsSummary();
                        this.updateInsertButton();
                    } }),
                h("span", { id: "slide-import-linksource-label" }, _('Stay linked to the source file'))),
            this.renderLinkMode()));
        body.hidden = !this.optionsOpen;
        return (h("div", { class: "slide-import-options" },
            h("button", { class: "slide-import-options-summary", "aria-expanded": String(this.optionsOpen), "aria-controls": "slide-import-options-body", onClick: () => this.toggleOptions() },
                h("span", { class: "slide-import-source-chevron", "aria-hidden": "true" }),
                h("span", { class: "slide-import-options-name" }, _('Options')),
                h("span", { class: "slide-import-options-state" }, this.optionsSummary())),
            body));
    }
    // What Update reads: the slide itself, or whatever stands in its place.
    // Both are links, so the group belongs under the checkbox that turns
    // linking on, and it is absent rather than disabled while that is off.
    renderLinkMode() {
        const group = (h("div", { class: "slide-import-linkmode", role: "radiogroup", "aria-labelledby": "slide-import-linksource-label" },
            this.renderLinkModeOption('slide', _('Follow the slide, wherever it moves')),
            this.renderLinkModeOption('position', _('Follow the slide number'))));
        group.hidden = !(this.session.linkToSource && this.session.canLink);
        return group;
    }
    renderLinkModeOption(key, label) {
        const id = 'slide-import-linkmode-' + key;
        const byPosition = key === 'position';
        return (h("div", { class: "radiobutton ui-radiobutton jsdialog" },
            h("input", { type: "radio", id: id, name: "slide-import-linkmode", checked: this.session.linkByPosition === byPosition, onChange: () => {
                    this.session.setLinkByPosition(byPosition);
                    this.updateOptionsSummary();
                    this.updateInsertButton();
                } }),
            h("label", { for: id }, label)));
    }
    // The slides of one source in order, with a header before the first slide
    // of each section, like the slide navigator shows the document's own
    // sections. Slides and sections are both in slide order, so one pointer
    // walks the sections along with the slides; consecutive sections can share
    // a start slide when a section is empty, and each still gets its own
    // header.
    renderListItems(source) {
        const items = [];
        let nextSection = 0;
        source.slides.forEach((slide) => {
            while (nextSection < source.sections.length &&
                source.sections[nextSection].startIndex <= slide.index) {
                items.push(this.renderSectionHeader(source, nextSection));
                nextSection++;
            }
            items.push(this.renderSlide(source, slide.index));
        });
        return items;
    }
    // The section a slide belongs to: the last section starting at or before
    // it. Slides in front of the first section belong to no section.
    sectionOf(source, index) {
        let result = null;
        for (const section of source.sections) {
            if (section.startIndex > index)
                break;
            result = section;
        }
        return result;
    }
    isSlideCollapsed(source, index) {
        const section = this.sectionOf(source, index);
        return section !== null && source.collapsedSections.has(section.name);
    }
    sectionSlideIndices(source, sectionIndex) {
        const section = source.sections[sectionIndex];
        if (!section || section.slideCount <= 0)
            return [];
        const indices = [];
        for (let i = section.startIndex; i < section.startIndex + section.slideCount; i++)
            indices.push(i);
        return indices;
    }
    isSectionPartlySelected(source, sectionIndex) {
        if (!this.isActive(source))
            return false;
        const indices = this.sectionSlideIndices(source, sectionIndex);
        if (!indices.length)
            return false;
        const picked = indices.filter((index) => this.session.selection.has(index)).length;
        return picked > 0 && picked < indices.length;
    }
    // The checkbox on a section row takes that section's slides into the
    // selection or out of it. The selection of the other sections stays, so a
    // reader can build an insert out of several of them.
    toggleSectionPick(source, sectionIndex) {
        const section = source.sections[sectionIndex];
        if (!section || section.slideCount <= 0)
            return;
        this.activate(source);
        const indices = this.sectionSlideIndices(source, sectionIndex);
        const take = !this.isSectionFullySelected(source, sectionIndex);
        this.session.setSelected(indices, take);
        if (take) {
            this.anchorIndex = section.startIndex;
            if (!this.isSlideCollapsed(source, section.startIndex))
                this.setFocusIndex(section.startIndex, false);
        }
    }
    isSectionFullySelected(source, sectionIndex) {
        if (!this.isActive(source))
            return false;
        const section = source.sections[sectionIndex];
        if (!section || section.slideCount <= 0)
            return false;
        for (let i = section.startIndex; i < section.startIndex + section.slideCount; i++) {
            if (!this.session.selection.has(i))
                return false;
        }
        return true;
    }
    // The header comes from the builder the slide navigator uses too, so both
    // panels show sections with the same markup and controls.
    renderSectionHeader(source, sectionIndex) {
        const section = source.sections[sectionIndex];
        const header = buildSlideSectionHeader(section.name, sectionIndex, source.collapsedSections.has(section.name), {
            onToggle: () => this.toggleSectionCollapse(source, sectionIndex),
            onSelect: () => this.selectSection(source, sectionIndex),
        }, _('{0} slides').replace('{0}', String(section.slideCount)), {
            rowToggles: true,
            pick: {
                checked: this.isSectionFullySelected(source, sectionIndex),
                partial: this.isSectionPartlySelected(source, sectionIndex),
                label: _('Select the slides of {0}').replace('{0}', section.name),
                onPick: () => this.toggleSectionPick(source, sectionIndex),
            },
        });
        if (this.isSectionFullySelected(source, sectionIndex))
            header.querySelector('.slide-section-name').classList.add('selected');
        return header;
    }
    toggleSectionCollapse(source, sectionIndex) {
        const section = source.sections[sectionIndex];
        if (!section)
            return;
        if (source.collapsedSections.has(section.name))
            source.collapsedSections.delete(section.name);
        else
            source.collapsedSections.add(section.name);
        // A hidden slide cannot hold the list's tab stop; hand it to the
        // first slide still on show.
        if (this.isActive(source) &&
            this.isSlideCollapsed(source, this.focusIndex)) {
            const firstVisible = source.slides
                .map((slide) => slide.index)
                .find((index) => !this.isSlideCollapsed(source, index));
            if (firstVisible !== undefined)
                this.focusIndex = firstVisible;
        }
        this.render();
        // The rebuild replaced the pressed chevron; keyboard focus continues on
        // its replacement.
        const list = this.slideList(source);
        const toggle = list
            ? list.querySelector('.slide-section-header[data-section-index="' +
                sectionIndex +
                '"] .slide-section-toggle')
            : null;
        if (toggle)
            toggle.focus();
    }
    // Clicking a header selects every slide of its section, like the slide
    // navigator does.
    selectSection(source, sectionIndex) {
        const section = source.sections[sectionIndex];
        if (!section || section.slideCount <= 0)
            return;
        this.activate(source);
        const start = section.startIndex;
        this.anchorIndex = start;
        this.session.selectRange(start, start + section.slideCount - 1);
        // A collapsed section's slides are hidden and cannot hold the list's
        // tab stop, so it stays where it is.
        if (!this.isSlideCollapsed(source, start))
            this.setFocusIndex(start, false);
    }
    // A section whose slides are all selected shows its name highlighted, like
    // the slide navigator does, and its checkbox answers for the slides under
    // it: checked while every one is picked, half checked while some are.
    updateSectionSelection(source) {
        const list = this.slideList(source);
        if (!list)
            return;
        list
            .querySelectorAll('.slide-section-header')
            .forEach((header) => {
            const sectionIndex = parseInt(header.dataset.sectionIndex, 10);
            const full = this.isSectionFullySelected(source, sectionIndex);
            const nameSpan = header.querySelector('.slide-section-name');
            if (nameSpan)
                nameSpan.classList.toggle('selected', full);
            const pick = header.querySelector('.slide-section-pick');
            if (pick) {
                pick.checked = full;
                pick.indeterminate = this.isSectionPartlySelected(source, sectionIndex);
            }
        });
    }
    // A blank picture with the slide's shape. Its intrinsic size gives the
    // frame the same footprint as the rendered thumbnail that replaces it,
    // so the list does not jump when the image arrives.
    placeholderUrl(source) {
        const width = source.docWidth > 0 ? source.docWidth : 16;
        const height = source.docHeight > 0 ? source.docHeight : 9;
        return ('data:image/svg+xml,' +
            encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' +
                width +
                '" height="' +
                height +
                '"/>'));
    }
    // The slide carries the navigator's preview markup and classes, so
    // partsPreviewControl.css renders the thumbnails of both panels the
    // same way, in the docked pane and in the maximized grid alike. The corner
    // checkbox is a CSS-drawn picture of the option's selection state, so
    // it stays out of the accessibility tree; the option itself announces
    // that state through aria-selected.
    renderSlide(source, index) {
        const thumbnail = source.thumbnails.get(index);
        const active = this.isActive(source);
        const selected = active && this.session.selection.has(index);
        const focused = active ? index === this.focusIndex : index === 0;
        return (h("div", { class: 'preview-frame slide-import-slide' +
                (this.isSlideCollapsed(source, index) ? ' section-collapsed' : ''), role: "option", "aria-selected": selected ? 'true' : 'false', "aria-label": this.slideLabel(source, index), "data-cooltip": this.slideLabel(source, index), tabindex: focused ? 0 : -1, "data-index": index, draggable: "true", onMouseDown: (e) => this.onSlideMouseDown(e, index), onClick: (e) => this.onSlideClick(e, source, index), onDragStart: (e) => this.onSlideDragStart(e, source, index) },
            h("span", { class: "preview-helper" }),
            h("span", { class: "preview-slide-number", "aria-hidden": "true" }),
            h("span", { class: "slide-import-thumb" },
                h("img", { class: 'preview-img' +
                        (selected ? ' preview-img-selectedpart' : '') +
                        (thumbnail ? '' : ' slide-import-skeleton'), src: thumbnail ? thumbnail.url : this.placeholderUrl(source), alt: "" }),
                h("span", { class: 'slide-import-checkbox' + (selected ? ' checked' : ''), "aria-hidden": "true" }))));
    }
    // Starts a drag that carries the slides to insert into the slides list.
    // Dragging a selected thumbnail carries the whole selection; dragging an
    // unselected one carries just that slide and leaves the selection alone.
    onSlideDragStart(e, source, index) {
        // A drag consumes the press, so no click follows it.
        this.pressedCheckboxIndex = -1;
        // The drag takes its slides out of the source it started in, so it makes
        // that source the active one, like a click on a slide does.
        if (!this.isActive(source)) {
            this.renderDeferred = true;
            this.activate(source);
            this.focusIndex = index;
            this.anchorIndex = index;
            this.session.selectOnly(index);
            this.renderDeferred = false;
            app.layoutingService.appendLayoutingTask(() => this.redraw());
        }
        const session = this.session;
        const slides = session.selection.has(index)
            ? Array.from(session.selection).sort((a, b) => a - b)
            : [index];
        if (!e.dataTransfer)
            return;
        // The drag carries only the custom type. A drag that starts on the
        // picture is a native image drag, which the browser preloads with the
        // picture's URL as text and HTML; clearing that keeps a drop on a text
        // input or another application from pasting the thumbnail data there.
        e.dataTransfer.clearData();
        e.dataTransfer.setData('application/x-cool-slide-import', JSON.stringify({ slides: slides }));
        e.dataTransfer.effectAllowed = 'copy';
        this.setDragGhost(e, source, index, slides);
    }
    // The picture under the pointer during the drag: the grabbed thumbnail
    // on top, the other dragged slides stacked behind it, and a badge with
    // the count, like the slide navigator's reorder drag shows.
    setDragGhost(e, source, index, slides) {
        if (!e.dataTransfer.setDragImage)
            return;
        const frame = e.currentTarget;
        const img = frame.querySelector('.preview-img');
        if (!img)
            return;
        const rect = img.getBoundingClientRect();
        const sources = [index]
            .concat(slides.filter((slide) => slide !== index))
            .map((slide) => {
            const thumbnail = source.thumbnails.get(slide);
            return thumbnail ? thumbnail.url : this.placeholderUrl(source);
        });
        const ghost = buildSlideDragGhost(sources, rect.width, rect.height, slides.length);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
        // The snapshot is taken when the dragstart handler returns; the ghost
        // element itself is no longer needed after that.
        setTimeout(() => ghost.remove(), 0);
    }
    // Selects the slides between the anchor and the target that are on show;
    // the hidden slides of a collapsed section in between stay unselected, so
    // sweeping a range never picks up slides the user cannot see.
    selectVisibleRange(source, anchor, target) {
        const from = Math.min(anchor, target);
        const to = Math.max(anchor, target);
        this.session.setSelection(source.slides
            .map((slide) => slide.index)
            .filter((index) => index >= from &&
            index <= to &&
            !this.isSlideCollapsed(source, index)));
    }
    onSlideMouseDown(e, index) {
        this.pressedCheckboxIndex =
            e.target instanceof Element &&
                e.target.closest('.slide-import-checkbox') !== null
                ? index
                : -1;
    }
    // Toggles one slide in and out of the selection and makes it the anchor
    // for a following range selection. The ctrl-click, space-key and corner
    // checkbox paths all toggle through here.
    toggleSlide(index) {
        this.anchorIndex = index;
        this.session.toggleSelection(index);
    }
    onSlideClick(e, source, index) {
        // A click that starts or ends on the slide's corner checkbox toggles
        // the slide like a ctrl-click, so the mouse builds a multi-selection
        // without a modifier key. The click bubbles on like any other slide
        // click, and the keyboard focus follows it into the list.
        const onCheckbox = this.pressedCheckboxIndex === index ||
            (e.target instanceof Element &&
                e.target.closest('.slide-import-checkbox') !== null);
        this.pressedCheckboxIndex = -1;
        // Picking a slide of another source starts a selection of that source.
        const switched = !this.isActive(source);
        this.activate(source);
        if (e.shiftKey && !switched) {
            this.selectVisibleRange(source, this.anchorIndex, index);
        }
        else if ((e.ctrlKey || e.metaKey || onCheckbox) && !switched) {
            this.toggleSlide(index);
        }
        else {
            this.anchorIndex = index;
            this.session.selectOnly(index);
        }
        this.setFocusIndex(index, true);
    }
    onListKeyDown(e, source) {
        // The keyboard works on the slides on show; the slides of collapsed
        // sections are neither selected nor stepped onto.
        const visible = source.slides
            .map((slide) => slide.index)
            .filter((index) => !this.isSlideCollapsed(source, index));
        if (visible.length === 0)
            return;
        // The keyboard picks slides of the source it is in, so a key press
        // starts a selection of that source.
        this.activate(source);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            this.session.setSelection(visible);
            e.preventDefault();
            return;
        }
        const position = visible.indexOf(this.focusIndex);
        let target = -1;
        if (e.key === 'ArrowDown')
            target = visible[Math.min(visible.length - 1, position + 1)];
        else if (e.key === 'ArrowUp')
            target = visible[Math.max(0, position - 1)];
        else if (e.key === 'Home')
            target = visible[0];
        else if (e.key === 'End')
            target = visible[visible.length - 1];
        if (target >= 0) {
            if (e.shiftKey) {
                this.selectVisibleRange(source, this.anchorIndex, target);
            }
            else if (!(e.ctrlKey || e.metaKey)) {
                this.anchorIndex = target;
                this.session.selectOnly(target);
            }
            this.setFocusIndex(target, true);
            e.preventDefault();
            return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
            this.toggleSlide(this.focusIndex);
            e.preventDefault();
        }
    }
    setFocusIndex(index, focus) {
        this.focusIndex = index;
        const source = this.activeSource();
        const list = source ? this.slideList(source) : null;
        if (!list)
            return;
        list.querySelectorAll('.slide-import-slide').forEach((option) => {
            const optionIndex = parseInt(option.dataset.index, 10);
            option.setAttribute('tabindex', optionIndex === index ? '0' : '-1');
            if (focus && optionIndex === index) {
                option.focus();
            }
        });
    }
}

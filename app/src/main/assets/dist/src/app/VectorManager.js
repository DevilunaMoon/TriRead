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
class VectorManager extends RenderManagerBase {
    constructor() {
        super(...arguments);
        this._renderer = new cool.VectorPrimitiveRenderer((checksum) => this._bitmaps.get(checksum) ?? this._standInFor(checksum), (fontId) => this._fonts.has(fontId), 
        // a picture the client made of a form control is drawn once it has loaded
        () => this._onPictureReady());
        // Cached parsed JSON primitive tree keyed by page id. The id names the
        // page wherever it sits in its list, so a slide inserted or removed
        // before a cached page leaves that page's content valid.
        this._cache = new Map();
        // Previews waiting for a JSON primitive tree response, keyed by page id.
        this._pendingPreviews = new Map();
        // Pages a JSON primitive tree request is in flight for, keyed by page id.
        this._inFlightParts = new Set();
        // Cached pages that may be behind the document, because the client was
        // away while they could change. A stale page is still drawn from the
        // cache, and its next draw asks for what changed since the version held.
        this._staleParts = new Set();
        // Stale pages drawn while as many were asking as may at a time, in the order they
        // were drawn. Each asks once an answer lands.
        this._revalidationsWaiting = [];
        // Stale pages that asked for what changed and wait for the answer.
        this._revalidating = new Set();
        // Pages the document said it does not hold. Asking again is pointless
        // until the page list is replaced.
        this._missingParts = new Set();
        // The bitmaps and fonts the parts name. Each part is an owner under its id, and keeps what
        // it named until it leaves the cache.
        this._resources = new VectorResourceLoader((partIds) => {
            this._redrawPartsUsing(partIds);
            // A decoded bitmap or a loaded font changes nothing at the engine, so no
            // object is answered.
            this._fireChanged([]);
        }, (checksum) => this._standIns.delete(checksum));
        // Decoded bitmap images keyed by their checksum.
        this._bitmaps = this._resources.images;
        /*
            Bitmaps drawn in place of one that is not decoded yet, by its checksum: the bitmap the
            object had at the same place before the engine's answer. A picture the engine renders
            anew at every size, a 3D scene for one, so shows the old picture at the new size until
            the new one is there, rather than nothing.
        */
        this._standIns = new Map();
        // Loaded font faces keyed by font id, registered on document.fonts
        // under the family name "vecfont-<id>".
        this._fonts = this._resources.fonts;
        // Size and part of every preview that has been rendered. A redraw
        // triggered by a decoded bitmap reuses these so the re-fired
        // preview keeps the size and part it was rendered at.
        this._renderedPreviews = new Map();
        // Callbacks fired when cached vector data changes: a part's
        // primitive tree arrived, a deferred bitmap decoded, or the cache
        // was cleared.
        this._changeListeners = new cool.VectorChangeListeners();
        // Ids of the layers this view does not show. Objects on them are
        // kept in the cache and skipped when drawing.
        this._hiddenLayers = new Set();
        /// The objects left out of the drawing of a part because they are drawn elsewhere. Its
        /// version tells a drawing kept from before apart from one that matches them.
        this._drawnElsewhere = new cool.DrawnElsewhere();
        // The measurer over that width, created on first use.
        this._textMeasurer = null;
        // The measured text of the last entry pointed at, reused while the tree still holds it and
        // nothing changed it here.
        this._objectText = null;
        // The x kept over moves by line, and the caret the last of them left.
        this._travelX = null;
        // The entry and the caret where a drag that selects text started.
        this._dragStart = null;
        // The edits typed here that the engine has not answered, of every part.
        this._typedEdits = new cool.UnansweredEdits();
        // whether the previews shown are to be drawn again for pictures that loaded just now
        this._previewsWaitForPictures = false;
    }
    // The most stale pages that ask for what changed at a time. A client back from being
    // away draws every cached page in view at once, and the engine compares every object
    // of a page it answers, so the pages ask a few at a time.
    static { this.revalidationsAtATime = 2; }
    // The Impress or Draw doc layer, read lazily so the manager can be
    // created before the layer is registered on the map.
    get _docLayer() {
        return app.map._docLayer;
    }
    /// The id of the view this client is, or undefined before the document
    /// reported it or before there is a document at all.
    get _ownViewId() {
        const docLayer = app.map?._docLayer;
        return docLayer?._viewId;
    }
    isVectorRendering() {
        return true;
    }
    /*
        Register a callback fired whenever cached vector data changes. It is handed the ids of
        the objects an answer from the engine replaced, an empty list where the change was made
        here and the engine answered nothing, and nothing at all where everything may have
        changed, as when a whole part arrives.
    */
    onVectorChanged(callback) {
        this._changeListeners.add(callback);
    }
    /// The view draws the part that is now selected, from the cache when it holds it, at once
    /// and without an answer from the engine.
    updateOnChangePart() {
        this._fireChanged();
    }
    /// Forget a callback registered with onVectorChanged.
    offVectorChanged(callback) {
        this._changeListeners.remove(callback);
    }
    _fireChanged(answered, inputSequence) {
        this._changeListeners.fire(answered, inputSequence);
    }
    /*
        Says that the objects the client holds have changed here rather than at the engine, which
        is what a drag does when it lays what it did on them. Whoever keeps a picture of a part
        draws it again, as it does when an update arrives.
    */
    changedHere() {
        // The objects changed in place, so text measured from them is out of date.
        this._objectText = null;
        this._fireChanged([]);
    }
    /// The id of the page at the given index of the page list on screen, or
    /// undefined when the list on screen is of another mode or holds no page
    /// at the index. The status message names every page of that list by id.
    partIdAt(part, mode) {
        const entry = app.impress?.partList?.[part];
        if (entry && entry.mode === mode && typeof entry.part === 'string')
            return entry.part;
        return undefined;
    }
    /// The index of the page with the given id in the page list on screen, or
    /// -1 when the list on screen is of another mode or does not hold the page.
    _indexOf(partId, mode) {
        const list = app.impress?.partList;
        if (!list)
            return -1;
        return list.findIndex((entry) => entry.mode === mode && entry.part === partId);
    }
    /// Return the cached primitive tree for the page at the given index of
    /// the page list on screen, or undefined while a request is sent or while
    /// the list does not name the page. Subscribers registered with
    /// onVectorChanged are notified once the data arrives, and again when the
    /// page list is replaced.
    requestPart(part, mode) {
        const partId = this.partIdAt(part, mode);
        if (partId === undefined)
            return undefined;
        return this.requestPartById(partId, mode);
    }
    /// Return the cached primitive tree for the page with the given id, or
    /// undefined while a request is sent.
    requestPartById(partId, mode) {
        const cached = this._cache.get(partId);
        if (cached) {
            this._revalidateIfStale(cached);
            return cached;
        }
        this._request(partId, mode);
        return undefined;
    }
    /// Ask for what changed on a stale page since the version held. A request
    /// already in flight brings the current content too, so it is not sent
    /// twice.
    _revalidateIfStale(held) {
        const partId = held.partId;
        if (!this._staleParts.has(partId) || this._inFlightParts.has(partId))
            return;
        if (this._revalidating.size >= VectorManager.revalidationsAtATime) {
            if (!this._revalidationsWaiting.includes(partId))
                this._revalidationsWaiting.push(partId);
            return;
        }
        this._staleParts.delete(partId);
        this._inFlightParts.add(partId);
        this._revalidating.add(partId);
        this._sendVectorPrimitivesRequest(partId, held.mode, held);
    }
    /// An answer for a page that asked what changed lets the next page waiting to ask do
    /// so. A waiting page that is no longer stale, no longer cached, or already has a request
    /// out, is passed over. The request out brings the current page.
    _revalidationAnswered(partId) {
        if (!this._revalidating.delete(partId))
            return;
        while (this._revalidationsWaiting.length > 0) {
            const next = this._revalidationsWaiting.shift();
            const held = next === undefined ? undefined : this._cache.get(next);
            if (held &&
                this._staleParts.has(held.partId) &&
                !this._inFlightParts.has(held.partId)) {
                this._revalidateIfStale(held);
                return;
            }
        }
    }
    /// Send for a page unless a request for it is already out.
    _request(partId, mode) {
        if (this._inFlightParts.has(partId) || this._missingParts.has(partId))
            return;
        this._inFlightParts.add(partId);
        this._sendVectorPrimitivesRequest(partId, mode);
    }
    /// Listen for the layers this view hides. The engine reports them as a
    /// state change whenever the view's layer state is rebuilt.
    initialize() {
        app.map.on('commandstatechanged', (event) => {
            if (event.commandName === '.uno:LayerVisibility')
                this.setHiddenLayers(event.state);
        });
    }
    /// The layers this view hides, given as their ids. Objects on them stay
    /// cached and are skipped when drawing. Anything that is not a list
    /// hides nothing.
    setHiddenLayers(layers) {
        const ids = Array.isArray(layers)
            ? layers.filter((id) => typeof id === 'number')
            : [];
        const next = new Set(ids);
        const same = next.size === this._hiddenLayers.size &&
            ids.every((id) => this._hiddenLayers.has(id));
        if (same)
            return;
        this._hiddenLayers = next;
        // Hiding a layer changes nothing at the engine, so no object is answered.
        this._fireChanged([]);
    }
    isLayerVisible(layer) {
        return !this._hiddenLayers.has(layer);
    }
    /// The objects to leave out of the drawing of a part from now on, since they are drawn
    /// elsewhere. An empty list leaves nothing out.
    drawnElsewhere(objectIds) {
        this._drawnElsewhere.set(objectIds);
    }
    drawnElsewhereVersion() {
        return this._drawnElsewhere.version();
    }
    /// The page rectangle carried by the entry that stands for the page, or
    /// zeroes when there is no such entry among the given objects.
    static pageBoundsOf(objects) {
        for (const object of objects) {
            if (object.kind === 'page')
                return [object.width ?? 0, object.height ?? 0];
        }
        return [0, 0];
    }
    /// Tell the renderer what the automatic colors mean in this view and what
    /// the page holds behind its objects. The tree carries both unresolved,
    /// and the renderer keeps what it was last given.
    _setUpColors(data) {
        this._renderer.setDocumentBackground(cool.VectorColors.documentBackground());
        const page = VectorManager._pageEntryOf(data.objects.values());
        this._renderer.setPageBackdrop(page?.backdrop, page?.backdropTransparency);
    }
    /// The color the text run is drawn in, with no animation color in its place.
    textColorOf(data, primitive) {
        this._setUpColors(data);
        return this._renderer.ownTextColor(primitive);
    }
    /// The entry that stands for the page among the given objects, if any.
    static _pageEntryOf(objects) {
        for (const object of objects) {
            if (object.kind === 'page')
                return object;
        }
        return undefined;
    }
    /// Take the master reference the page entry carries into the cached part
    /// and fetch the master, so it is usually cached before the first paint.
    _takeMasterReference(data, page) {
        data.masterPartId = page.masterPartId;
        data.masterHiddenLayers = page.masterHiddenLayers
            ? new Set(page.masterHiddenLayers)
            : undefined;
        if (data.masterPartId !== undefined)
            this.requestPartById(data.masterPartId, cool.VectorMode.MasterPages);
    }
    /// True when the part and the master it names are both cached. Fetches
    /// whatever is missing.
    isPartDrawable(part, mode) {
        const data = this.requestPart(part, mode);
        if (!data)
            return false;
        return this._isDrawable(data);
    }
    /// True when the page with the given id and the master it names are both
    /// cached. Fetches whatever is missing.
    isPartDrawableById(partId, mode) {
        const data = this.requestPartById(partId, mode);
        if (!data)
            return false;
        return this._isDrawable(data);
    }
    _isDrawable(data) {
        if (data.masterPartId === undefined)
            return true;
        return (this.requestPartById(data.masterPartId, cool.VectorMode.MasterPages) !==
            undefined);
    }
    /// Render a part's objects in paint order, the page entry first. The
    /// caller sets up the context transform that maps the part's twips to
    /// the target pixels. Objects on a hidden layer are skipped.
    renderInto(context, data, options) {
        this._renderer.setSlideBounds(data.slideWidth, data.slideHeight);
        this._renderer.setEditViewContentVisible(options?.editView === true);
        this._renderer.setAuthoredColors(options?.authoredColors === true);
        this._setUpColors(data);
        const textEdits = this._textEditEntriesToDraw(data);
        // an object active in place covers its upright window, not its own box
        const window = options?.activeInPlace?.area;
        const edited = options?.edited !== undefined
            ? VectorManager._editedPart(data, options.edited.objectId, options.activeInPlace?.objectId === options.edited.objectId &&
                window
                ? [
                    window[0],
                    window[1],
                    window[0] + window[2],
                    window[1] + window[3],
                ]
                : undefined)
            : undefined;
        const range = options?.paintRange;
        let index = -1;
        for (const id of data.order) {
            ++index;
            if (range && (index < range.start || index >= range.end))
                continue;
            const obj = data.objects.get(id);
            if (!obj)
                continue;
            if (obj.layer !== undefined && this._hiddenLayers.has(obj.layer))
                continue;
            if (obj.kind === 'texteditoverlay' && !textEdits.has(id))
                continue;
            if (this._drawnElsewhere.has(id))
                continue;
            // The slide's copy of a master placeholder is drawn with the master.
            if (obj.masterContent)
                continue;
            const state = VectorManager.stateOf(data, id, options?.states);
            if (state?.hidden)
                continue;
            if (obj.primitives) {
                const outside = edited !== undefined &&
                    obj.kind === undefined &&
                    !VectorManager._isInside(data, id, edited.objectId);
                const inFront = outside &&
                    index > edited.lastAt &&
                    VectorManager._overlaps(obj, edited.box);
                const pale = outside && options?.edited?.paleOutside === true;
                if (pale || inFront)
                    this._renderGhosted(context, obj, inFront, pale);
                else if (state)
                    this._renderInState(context, obj, state);
                else
                    for (const primitive of obj.primitives) {
                        this._renderer.renderPrimitive(context, primitive);
                    }
            }
            // The master lies between the page's own background and its objects.
            if (obj.kind === 'page')
                this._renderMaster(context, data);
        }
    }
    /// Draw one paragraph of an object's text alone, in the colors and text look given. The
    /// context transform maps the part's twips to the target pixels.
    renderObjectParagraph(context, data, objectId, paragraph, colorOverride, textOverride) {
        const object = data.objects.get(objectId);
        if (!object)
            return;
        this._renderer.setSlideBounds(data.slideWidth, data.slideHeight);
        this._renderer.setEditViewContentVisible(false);
        this._setUpColors(data);
        this._renderUnder(context, object, { colorOverride, textOverride }, { only: paragraph });
    }
    // The state of the object, or else of the nearest group above it, since an effect on a
    // group moves every member. Undefined when neither has one.
    static stateOf(data, objectId, states) {
        if (!states)
            return undefined;
        for (let at = objectId, guard = 0; at !== undefined && guard < 100; at = data.objects.get(at)?.parent, ++guard) {
            const state = states.get(at);
            if (state)
                return state;
        }
        return undefined;
    }
    // Draw the object in its state, without the paragraphs that have a state of their own.
    // Those follow right after, each in its own state, so they keep their place in the paint
    // order.
    _renderInState(context, object, state) {
        const paragraphs = state.paragraphs
            ? [...state.paragraphs.entries()].sort(([first], [second]) => first - second)
            : [];
        this._renderUnder(context, object, state, paragraphs.length ? { skip: paragraphs.map(([index]) => index) } : null);
        for (const [index, paragraphState] of paragraphs)
            this._renderUnder(context, object, paragraphState, { only: index });
    }
    _renderUnder(context, object, state, paragraphFilter) {
        if (state.hidden || !object.primitives)
            return;
        context.save();
        if (state.alpha !== undefined)
            context.globalAlpha = state.alpha;
        const matrix = cool.Matrix2D.fromArray(state.transform);
        if (matrix)
            matrix.applyTo(context);
        if (state.clip)
            VectorManager.clipTo(context, state.clip);
        this._renderer.setColorOverride(state.colorOverride ?? null);
        this._renderer.setTextOverride(state.textOverride ?? null);
        this._renderer.setParagraphFilter(paragraphFilter);
        for (const primitive of object.primitives) {
            this._renderer.renderPrimitive(context, primitive);
        }
        this._renderer.setParagraphFilter(null);
        this._renderer.setTextOverride(null);
        this._renderer.setColorOverride(null);
        context.restore();
    }
    /*
        Clip what is drawn next to the clip's area. The clip's transform applies only while
        its paths are built.
    */
    static clipTo(context, clip) {
        const saved = context.getTransform();
        cool.Matrix2D.fromArray(clip.transform)?.applyTo(context);
        const [x, y, width, height] = clip.frame;
        const frame = new Path2D();
        frame.rect(x, y, width, height);
        context.clip(frame);
        // Frame and pieces in one even-odd path: the frame minus the pieces, which do not overlap.
        const area = new Path2D();
        if (clip.inverted)
            area.rect(x, y, width, height);
        for (const piece of clip.pieces)
            VectorManager._addPiece(area, piece);
        context.clip(area, clip.inverted ? 'evenodd' : 'nonzero');
        context.setTransform(saved);
    }
    // Each piece is a figure of its own.
    static _addPiece(path, piece) {
        if ('rectangle' in piece) {
            const [x, y, width, height] = piece.rectangle;
            path.rect(x, y, width, height);
        }
        else if ('polygon' in piece) {
            const corners = piece.polygon;
            if (corners.length < 6)
                return;
            path.moveTo(corners[0], corners[1]);
            for (let at = 2; at + 1 < corners.length; at += 2)
                path.lineTo(corners[at], corners[at + 1]);
            path.closePath();
        }
        else if ('ellipse' in piece) {
            const [centerX, centerY, radiusX, radiusY] = piece.ellipse;
            path.moveTo(centerX + radiusX, centerY);
            path.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            path.closePath();
        }
        else {
            const [centerX, centerY, radius, start, end] = piece.slice;
            path.moveTo(centerX, centerY);
            path.arc(centerX, centerY, radius, start, end);
            path.closePath();
        }
    }
    // whether the object is the one edited or lies in it, a group, at any depth
    static _isInside(data, objectId, editedId) {
        for (let at = objectId, guard = 0; at !== undefined && guard < 100; at = data.objects.get(at)?.parent, ++guard)
            if (at === editedId)
                return true;
        return false;
    }
    /*
        What is being edited, a group or one object, as the ghosting needs it: the place of its
        last object in the paint order, and the box round its objects, or the box given. An object
        after that place and over that box lies in front of what is being edited.
    */
    static _editedPart(data, objectId, given) {
        let lastAt = -1;
        let box = given;
        data.order.forEach((id, at) => {
            const object = data.objects.get(id);
            if (!object || object.kind !== undefined)
                return;
            if (!VectorManager._isInside(data, id, objectId))
                return;
            lastAt = at;
            const own = VectorManager._boxOf(object);
            if (!own || given)
                return;
            box = box
                ? [
                    Math.min(box[0], own[0]),
                    Math.min(box[1], own[1]),
                    Math.max(box[2], own[2]),
                    Math.max(box[3], own[3]),
                ]
                : own;
        });
        return { objectId, lastAt, box };
    }
    // the box an object paints in, as [minX, minY, maxX, maxY] in twips, where it has one
    static _boxOf(object) {
        return object.x !== undefined &&
            object.y !== undefined &&
            object.width !== undefined &&
            object.height !== undefined
            ? [object.x, object.y, object.x + object.width, object.y + object.height]
            : undefined;
    }
    static _overlaps(object, box) {
        const own = VectorManager._boxOf(object);
        return (!!own &&
            !!box &&
            own[0] < box[2] &&
            box[0] < own[2] &&
            own[1] < box[3] &&
            box[1] < own[3]);
    }
    /*
        How what lies outside what is being edited is drawn, from the settings: the colour it is
        mixed with (vectorGhostColor, the document background of the view), how far towards it
        from 0 to 1 (vectorGhostAmount, 0.5 as the office has it), and how transparent an object
        in front of it is from 0 to 1 (vectorGhostTransparency, 0.8), so that what is edited
        shows through.
    */
    static _ghosting() {
        const share = (name, byDefault) => {
            const value = window.prefs?.getNumber(name, byDefault) ?? byDefault;
            return value >= 0 && value <= 1 ? value : byDefault;
        };
        const background = cool.VectorColors.documentBackground();
        const color = window.prefs?.get('vectorGhostColor', background);
        return {
            color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
                ? color
                : background,
            amount: share('vectorGhostAmount', 0.5),
            transparency: share('vectorGhostTransparency', 0.8),
        };
    }
    // an object outside what is being edited, mixed towards the ghost colour where pale, as the
    // office draws it, and made transparent where it lies in front
    _renderGhosted(context, object, inFront, pale) {
        const ghosting = VectorManager._ghosting();
        // the box the object paints in bounds the change, without one it covers the view
        const mixed = {
            type: cool.ModifiedColorPrimitive.type,
            modifier: 'interpolate',
            color: ghosting.color,
            // the value is the share of the original colour
            value: 1 - ghosting.amount,
            bounds: VectorManager._boxOf(object),
            children: object.primitives,
        };
        const drawn = pale ? [mixed] : (object.primitives ?? []);
        if (!inFront) {
            for (const primitive of drawn)
                this._renderer.renderPrimitive(context, primitive);
            return;
        }
        this._renderer.renderPrimitive(context, {
            type: cool.UnifiedTransparencePrimitive.type,
            transparence: ghosting.transparency,
            children: drawn,
        });
    }
    /*
        Draw the objects named, with a transformation laid over what they draw. It is the picture
        a drag shows of itself: the objects as they would look where the drag has taken them. The
        caller sets up the context the same way as for a whole part.
    */
    renderObjectsWith(context, data, objectIds, matrix) {
        this._renderer.setSlideBounds(data.slideWidth, data.slideHeight);
        this._renderer.setEditViewContentVisible(true);
        this._renderer.setAuthoredColors(false);
        this._setUpColors(data);
        this._renderer.renderObjectsMoved(context, data.objects, objectIds, matrix);
    }
    /// Draw the master that a page names under it, in the master's order. A
    /// shared object comes from the master, a per-slide one from the page's
    /// own copy, if it has one. An object on a layer the page hides is left
    /// out. The master's page entry is skipped, since the page draws its own
    /// background. A text edit on a master object is drawn from its edit
    /// entry, since the object hides its text during the edit.
    _renderMaster(context, data) {
        if (data.masterPartId === undefined)
            return;
        const master = this._cache.get(data.masterPartId);
        if (!master)
            return;
        const textEdits = this._textEditEntriesToDraw(master);
        for (const id of master.order) {
            const obj = master.objects.get(id);
            if (!obj || obj.hiddenBehindSlide)
                continue;
            if (obj.kind !== undefined) {
                if (obj.kind !== 'texteditoverlay' || !textEdits.has(id))
                    continue;
                const parent = master.objects.get(obj.parent ?? 0);
                if (parent?.hiddenBehindSlide)
                    continue;
            }
            if (obj.layer !== undefined && this._hiddenLayers.has(obj.layer))
                continue;
            if (obj.layer !== undefined && data.masterHiddenLayers?.has(obj.layer))
                continue;
            const drawn = obj.slideDependent ? data.objects.get(id) : obj;
            if (!drawn?.primitives)
                continue;
            for (const primitive of drawn.primitives) {
                this._renderer.renderPrimitive(context, primitive);
            }
        }
    }
    /// The text edit entries to draw, one per edited object: this view's own
    /// where it has one, otherwise the first in the order. Several views can
    /// edit one object, and drawing every entry would paint the text twice.
    /// One entry is always drawn, whichever view is editing, because an object
    /// under edit carries none of its own text, so the edit entry is the only
    /// source of that text.
    _textEditEntriesToDraw(data) {
        const ownViewId = this._ownViewId;
        const chosen = new Map();
        for (const id of data.order) {
            const obj = data.objects.get(id);
            if (!obj || obj.kind !== 'texteditoverlay')
                continue;
            const parent = obj.parent ?? 0;
            const current = chosen.get(parent);
            const isOwn = ownViewId !== undefined && obj.viewId === ownViewId;
            if (!current || (isOwn && current.viewId !== ownViewId))
                chosen.set(parent, obj);
        }
        const ids = new Set();
        for (const obj of chosen.values()) {
            if (obj.id !== undefined)
                ids.add(obj.id);
        }
        return ids;
    }
    /// Draw the aids that mark out the placeholders on a page: the dashed
    /// boundary of each and, on a master page, the name of the area. They
    /// are drawn over the page content, so a later object does not cover
    /// them, and objects on a hidden layer are skipped as ever.
    renderPlaceholderAids(context, data) {
        this._renderer.setSlideBounds(data.slideWidth, data.slideHeight);
        this._renderer.setAuthoredColors(false);
        this._setUpColors(data);
        for (const id of data.order) {
            const obj = data.objects.get(id);
            if (!obj || !obj.aids)
                continue;
            if (obj.layer !== undefined && this._hiddenLayers.has(obj.layer))
                continue;
            for (const primitive of obj.aids) {
                this._renderer.renderPrimitive(context, primitive);
            }
        }
    }
    /*
        Draw primitives the client built itself, in document twips, the way the objects of the
        part are drawn. The caller sets up the context the same way as for a whole part.
    */
    renderPrimitives(context, data, primitives) {
        this._renderer.setSlideBounds(data.slideWidth, data.slideHeight);
        this._renderer.setEditViewContentVisible(true);
        this._renderer.setAuthoredColors(false);
        this._setUpColors(data);
        for (const primitive of primitives)
            this._renderer.renderPrimitive(context, primitive);
    }
    /// Redraw what is on screen in the view's current theme. The cached
    /// trees hold the automatic colors unresolved, so a theme change
    /// costs a repaint and nothing else.
    refreshTheme() {
        for (const [id, info] of this._renderedPreviews) {
            const data = this._cache.get(info.partId);
            if (data)
                this._renderAndFire(id, info.maxWidth, info.maxHeight, data);
        }
        this._fireChanged();
    }
    /// Request a thumbnail for a preview of the page at the given index of
    /// the page list on screen. Nothing is drawn while the list does not name
    /// the page.
    requestThumbnail(id, part, mode, maxWidth, maxHeight) {
        const partId = this.partIdAt(part, mode);
        if (partId === undefined)
            return;
        const cached = this._cache.get(partId);
        if (cached)
            this._revalidateIfStale(cached);
        if (cached && this._isDrawable(cached)) {
            this._renderAndFire(id, maxWidth, maxHeight, cached);
            return;
        }
        // The part or the master it names is still on its way, so the preview
        // waits for whichever arrives last.
        let queue = this._pendingPreviews.get(partId);
        if (!queue) {
            queue = [];
            this._pendingPreviews.set(partId, queue);
        }
        // One preview waits once, at the size it last asked for.
        const pending = { id: id, maxWidth: maxWidth, maxHeight: maxHeight };
        const waiting = queue.findIndex((entry) => entry.id === id);
        if (waiting >= 0)
            queue[waiting] = pending;
        else
            queue.push(pending);
        if (!cached)
            this._request(partId, mode);
    }
    _sendVectorPrimitivesRequest(partId, mode, held) {
        // A client that holds the page says at which version, and in which
        // version space, so the answer is the step from there rather than
        // the whole page.
        const holds = held?.version !== undefined && held.epoch !== undefined;
        app.socket.sendMessage(cool.vectorPrimitivesRequest({
            partId: partId,
            mode: mode,
            epoch: holds ? held?.epoch : undefined,
            since: holds ? held?.version : undefined,
        }));
    }
    /// Handle a vector primitives response.
    handleVectorPrimitivesResponse(values) {
        const mode = values.mode !== undefined ? values.mode : cool.VectorMode.Slides;
        // Every request names its page by id, and the answer names it back.
        const partId = values.partId;
        if (partId === undefined)
            return;
        this._inFlightParts.delete(partId);
        this._revalidationAnswered(partId);
        // A response with no objects names a part the document does not
        // hold. It happens while the page list is catching up with a mode
        // switch, or when the page was removed while the client was away. So
        // nothing stays cached for it, the previews queued for a page that
        // is not there are dropped, and the page is not asked for again until
        // the page list is replaced.
        if (values.objects === undefined) {
            this._cache.delete(partId);
            this._staleParts.delete(partId);
            this._pendingPreviews.delete(partId);
            this._missingParts.add(partId);
            return;
        }
        // A full response older than the cache would roll it back, so the
        // cache keeps its newer version and the waiting previews are drawn
        // from that. Versions from two epochs cannot be compared, so a
        // response from another epoch always replaces the cache.
        const held = this._cache.get(partId);
        if (held?.epoch === values.epoch &&
            held?.version !== undefined &&
            values.version !== undefined &&
            values.version < held.version) {
            this._drainDrawable(partId);
            return;
        }
        const received = values.objects;
        const objects = new Map();
        const arrived = [];
        for (const object of received) {
            if (object.id === undefined)
                continue;
            objects.set(object.id, object);
            arrived.push(object.id);
        }
        const [nWidth, nHeight] = VectorManager.pageBoundsOf(received);
        const data = {
            partId: partId,
            mode: mode,
            epoch: values.epoch,
            version: values.version,
            slideWidth: nWidth,
            slideHeight: nHeight,
            objects: objects,
            // A full response lists the objects in paint order, so the order
            // they arrive in is the order they are drawn in.
            order: values.order || arrived,
        };
        const page = VectorManager._pageEntryOf(received);
        if (page)
            this._takeMasterReference(data, page);
        this._cache.set(partId, data);
        this._staleParts.delete(partId);
        this._resources.add(partId, (walker) => {
            walker.walkObjects(received);
        });
        // A preview already shown for the page is drawn again from the new
        // content. This is how a client that asked for its cached pages again
        // after being away gets fresh thumbnails. A preview that was waiting
        // for this response is drawn by the drain alone.
        const drained = this._drainDrawable(partId);
        if (this._isDrawable(data))
            this._redrawRenderedPreviews(partId, drained);
        if (mode === cool.VectorMode.MasterPages)
            this._onMasterArrived(partId);
        this._reconcile(partId, values.inputSequence);
        this._fireChanged(undefined, values.inputSequence);
        this.setVisualsReady();
    }
    /// A master arrived or changed, so every page drawing under it can be
    /// drawn now, and every preview showing such a page is drawn again. Which
    /// pages those are is read off the cache.
    _onMasterArrived(masterPartId) {
        for (const [partId, data] of this._cache) {
            if (data.masterPartId !== masterPartId)
                continue;
            this._drainDrawable(partId);
            this._redrawRenderedPreviews(partId);
        }
    }
    /// Apply a pushed delta and replay the pending edits on the objects it
    /// replaced.
    handleVectorPrimitivesDelta(values) {
        const partId = values.partId;
        if (partId === undefined)
            return;
        const replaced = this._applyDelta(values);
        if (!replaced)
            return;
        this._reconcile(partId, values.inputSequence, replaced);
    }
    /// Apply a delta to a cached part. The objects it carries replace
    /// theirs and the rest keep what was cached. A delta not newer than
    /// the cache is ignored. A part that is not cached, a delta that starts
    /// above the version held, or an order that names content the client
    /// never had, falls back to a full re-fetch. Returns the ids of the
    /// objects it replaced, or null when the cached tree is unchanged.
    _applyDelta(values) {
        const partId = values.partId;
        if (partId === undefined)
            return null;
        const cached = this._cache.get(partId);
        if (!cached)
            return null;
        // A delta is also what answers a request that said which version the
        // client holds, and only a client that holds the page says that.
        this._inFlightParts.delete(partId);
        this._revalidationAnswered(partId);
        // A delta from another epoch counts its versions from another start, so
        // it says nothing about what is cached and the part is fetched whole.
        if (cached.epoch !== values.epoch) {
            this.clearCachedPart(partId);
            return null;
        }
        // Every later delta is checked against the version, so a delta without
        // one cannot be applied.
        if (values.version === undefined) {
            window.app.console.warn('VectorPrimitivesDelta: delta for part ' +
                partId +
                ' carries no version and is ignored');
            return null;
        }
        // A delta computed against an older version can arrive after a
        // newer full response. Its order describes that older state, so
        // applying it would roll the cache backwards.
        if (cached.version !== undefined &&
            values.version !== undefined &&
            values.version <= cached.version)
            return null;
        // A delta that starts at or below the version held carries every object that changed
        // since, and each entry replaces a whole object, so it is applied as it is. A delta that
        // starts above the version held leaves out the objects that changed in between, and no
        // later delta carries them, so the part is dropped and the next draw asks for it whole.
        if (cached.version !== undefined &&
            values.from !== undefined &&
            values.from > cached.version) {
            this.clearCachedPart(partId);
            return null;
        }
        const carried = values.objects || [];
        // The order is the paint order, so an object it does not name has no
        // place to be drawn. Without a new order the part is fetched whole.
        if (!values.order) {
            const known = new Set(cached.order);
            if (carried.some((object) => object.id !== undefined && !known.has(object.id))) {
                this.clearCachedPart(partId);
                return null;
            }
        }
        for (const object of carried) {
            if (object.id === undefined)
                continue;
            const before = cached.objects.get(object.id);
            if (before)
                this._noteStandIns(before, object);
            cached.objects.set(object.id, object);
        }
        // The page rectangle rides on the page entry, so a delta that carries
        // that entry is also how a resized page reaches the client. So does the
        // master the page draws under itself and the page's copies of its objects.
        const [nWidth, nHeight] = VectorManager.pageBoundsOf(carried);
        if (nWidth > 0 && nHeight > 0) {
            cached.slideWidth = nWidth;
            cached.slideHeight = nHeight;
        }
        const page = VectorManager._pageEntryOf(carried);
        if (page)
            this._takeMasterReference(cached, page);
        // The order travels only when the object set or its order changed.
        // When it does it names the whole live set, so anything missing from
        // it is gone and is dropped from the cache.
        if (values.order) {
            for (const id of values.order) {
                if (!cached.objects.has(id)) {
                    this.clearCachedPart(partId);
                    return null;
                }
            }
            const live = new Set(values.order);
            const gone = [];
            for (const id of cached.objects.keys()) {
                if (!live.has(id))
                    gone.push(id);
            }
            for (const id of gone)
                cached.objects.delete(id);
            cached.order = values.order;
        }
        cached.version = values.version;
        this._resources.add(partId, (walker) => {
            walker.walkObjects(carried);
        });
        this._redrawRenderedPreviews(partId);
        if (cached.mode === cool.VectorMode.MasterPages)
            this._onMasterArrived(partId);
        const replaced = carried.flatMap((object) => object.id === undefined ? [] : [object.id]);
        this._fireChanged(replaced, values.inputSequence);
        return replaced;
    }
    /// The decoded bitmap standing in for that checksum, where one does.
    _standInFor(checksum) {
        const standIn = this._standIns.get(checksum);
        return standIn === undefined ? undefined : this._bitmaps.get(standIn);
    }
    // The bitmaps the primitives name, in the order they are drawn.
    static _bitmapsInOrder(primitives) {
        const found = [];
        const walk = (list) => {
            for (const primitive of list) {
                if (cool.GraphicResource.is(primitive))
                    found.push(primitive.checksum);
                const fillGraphic = primitive
                    .fillGraphic;
                if (fillGraphic && typeof fillGraphic.checksum === 'number')
                    found.push(fillGraphic.checksum);
                const transparence = primitive
                    .transparence;
                if (Array.isArray(transparence))
                    walk(transparence);
                if (primitive.children)
                    walk(primitive.children);
            }
        };
        walk(primitives ?? []);
        return found;
    }
    /*
        Pairs the bitmaps of an object as it was and as the engine answered, in drawing order,
        and notes the old one as standing in for each new one that is not decoded yet.
    */
    _noteStandIns(before, after) {
        const was = VectorManager._bitmapsInOrder(before.primitives);
        const now = VectorManager._bitmapsInOrder(after.primitives);
        const count = Math.min(was.length, now.length);
        for (let at = 0; at < count; ++at) {
            if (now[at] === was[at] || this._bitmaps.get(now[at]))
                continue;
            // the old one may itself still be stood in for
            const standIn = this._bitmaps.get(was[at])
                ? was[at]
                : this._standIns.get(was[at]);
            if (standIn !== undefined)
                this._standIns.set(now[at], standIn);
        }
    }
    // The width of a string as the renderer draws the run, so predicted widths
    // match the screen.
    _textMeasure() {
        return cool.canvasTextMeasure((fontId) => this._fonts.has(fontId));
    }
    _measurer() {
        if (!this._textMeasurer)
            this._textMeasurer = new cool.TextMeasurer(this._textMeasure());
        return this._textMeasurer;
    }
    _treeOf(data) {
        return new cool.PredictionTree(data, this._measurer());
    }
    _textOf(tree, entryId) {
        const kept = this._objectText;
        if (kept &&
            kept.entryId === entryId &&
            kept.text.isCollectedFrom(tree, entryId))
            return kept.text;
        const text = cool.ObjectText.collectFrom(tree, entryId);
        this._objectText = text ? { entryId, text } : null;
        return text;
    }
    /// The id of the page in the edit view, or undefined while the page list
    /// does not name it.
    _selectedPartId() {
        const entry = app.impress?.partList?.[this._docLayer._selectedPart];
        return typeof entry?.part === 'string' ? entry.part : undefined;
    }
    /// The tree with the entries of other views' running text edits left out of
    /// the order. Every view that edits an object has its own entry for it.
    _asThisViewEditsIt(data) {
        const ownViewId = this._ownViewId;
        if (ownViewId === undefined)
            return data;
        const order = data.order.filter((id) => {
            const object = data.objects.get(id);
            return object?.kind !== 'texteditoverlay' || object.viewId === ownViewId;
        });
        return order.length === data.order.length ? data : { ...data, order };
    }
    // The cached tree and caret of the edited part, or null when no caret is visible, the part
    // is not cached, or text is selected that the edit does not cover.
    _editTarget(overSelection = false) {
        // An edit covers a selection in the caret's paragraph whose ends the client knows.
        // A selection over a paragraph break alone draws no rectangle, so its anchor counts
        // too.
        const selected = TextSelections.isActive() || Boolean(app.file.textCursor.anchor);
        if (selected && !(overSelection && this._selectionAnchorInParagraph()))
            return null;
        return this._caretTarget();
    }
    // The other end of a selection in the caret's paragraph, or null when there is none or its
    // start is not known.
    _selectionAnchorInParagraph() {
        const cursor = app.file.textCursor;
        const anchor = cursor.anchor;
        return anchor &&
            cursor.logical &&
            anchor.paragraph === cursor.logical.paragraph
            ? anchor
            : null;
    }
    // The cached tree and caret of the edited part, with text selected or not, or null when no
    // caret is visible or the part is not cached.
    _caretTarget() {
        const cursor = app.file.textCursor;
        if (!cursor || !cursor.visible || !cursor.rectangle)
            return null;
        const partId = this._selectedPartId();
        const data = partId === undefined ? undefined : this._cache.get(partId);
        if (!data)
            return null;
        return {
            tree: this._treeOf(this._asThisViewEditsIt(data)),
            caret: cursor.rectangle,
            logical: cursor.logical ?? null,
        };
    }
    // The caret position in the edit target, or null.
    _lookUpCaret(target) {
        return target.tree.caretAt(target.caret.x1, target.caret.y1, target.caret.y2, target.logical ?? undefined);
    }
    /// True when a keystroke at the caret can be predicted. The tree stays
    /// unchanged.
    canPredictAtCaret() {
        const target = this._editTarget();
        return target !== null && this._lookUpCaret(target) !== null;
    }
    /// Insert typed text into the cached tree so it shows before the server re-renders. It
    /// replaces a selection in the caret's paragraph, as in the engine. True when the tree
    /// changed.
    predictTextInsert(text) {
        return this._predictEdit((selected) => cool.typedChange(text, selected));
    }
    /// Delete before characters left of the caret and after characters right of it in the
    /// cached tree. A selection in the caret's paragraph is the first one deleted, as in the
    /// engine. True when the tree changed.
    predictTextDelete(before, after) {
        if (before <= 0 && after <= 0)
            return false;
        return this._predictEdit((selected) => cool.deletedChange(before, after, selected));
    }
    /*
        The anchor a move here selects from, or null for no selection. Undefined when the
        move is for the server: it drops a selection, or the anchor is not known here.
    */
    _anchorForMove(caret, extend) {
        const anchor = app.file.textCursor.anchor ?? null;
        // A selection over a paragraph break alone draws no rectangle and still has its
        // anchor.
        if (extend && anchor)
            return anchor;
        if (TextSelections.isActive())
            return undefined;
        return extend ? { paragraph: caret.paragraph, index: caret.index } : null;
    }
    /// Move the caret one character left (step -1) or right (step 1). With extend, the
    /// selection follows the caret. True when it moved.
    moveCaretByCharacter(step, extend = false) {
        return this._stepCaret(extend, (position, logical) => cool.stepByCharacter(position, logical, step));
    }
    /// Move the caret one word left (step -1) or right (step 1). With extend, the selection
    /// follows the caret. True when it moved.
    moveCaretByWord(step, extend = false) {
        return this._stepCaret(extend, (position, logical) => cool.stepByWord(position, logical, step));
    }
    // Move the caret to where step takes it, and with extend select from the anchor to it. True
    // when it moved.
    _stepCaret(extend, step) {
        const start = this._moveStart(extend);
        if (!start)
            return false;
        const logical = step(start.position, start.logical);
        return (logical !== null &&
            this._moveCaret(start.target, start.entryId, logical, start.anchor));
    }
    // Where a caret key moves the caret from: the edited part, the caret, the anchor the move
    // selects from and the caret's entry. Null when the move is for the server.
    _moveStart(extend) {
        const target = this._caretTarget();
        if (!target || !target.logical)
            return null;
        const anchor = this._anchorForMove(target.logical, extend);
        if (anchor === undefined)
            return null;
        const position = this._lookUpCaret(target);
        const entryId = position?.objectId;
        if (!position || entryId === undefined)
            return null;
        return { target, logical: target.logical, anchor, position, entryId };
    }
    /// Move the caret one line up (step -1) or down (step 1), keeping its starting x over
    /// several moves. With extend, the selection follows the caret. True when it moved.
    moveCaretByLine(step, extend = false) {
        const start = this._moveStart(extend);
        if (!start)
            return false;
        const { target, entryId, position } = start;
        const travel = this._travelX;
        const x = travel &&
            travel.logical.paragraph === start.logical.paragraph &&
            travel.logical.index === start.logical.index
            ? travel.x
            : position.geometry().x;
        const logical = this._textOf(target.tree, entryId)?.caretOnNextLine(position.run, x, step) ?? null;
        if (!logical || !this._moveCaret(target, entryId, logical, start.anchor))
            return false;
        this._travelX = { x, logical: { ...logical } };
        return true;
    }
    // The entry that holds the caret for a press at (x, y) on the object hitId, or undefined
    // when the press is for the server.
    _pressedEntry(target, hitId, x, y) {
        const entryId = this._lookUpCaret(target)?.objectId;
        if (entryId === undefined)
            return undefined;
        const partId = target.tree.data.partId;
        // A press off the edited object ends the edit, so it is for the engine.
        if (hitId === undefined ||
            (hitId !== entryId && hitId !== this._editedObjectOf(partId, entryId)) ||
            !this._mayHoldTheCaret(partId, entryId, hitId, x, y))
            return undefined;
        return entryId;
    }
    // The edited part, the entry and the caret where a press at (x, y) on the object hitId
    // lands, or null when the press is for the server.
    _pressAt(x, y, hitId) {
        const target = this._caretTarget();
        if (!target)
            return null;
        const entryId = this._pressedEntry(target, hitId, x, y);
        if (entryId === undefined)
            return null;
        const logical = this._textOf(target.tree, entryId)?.caretAtPoint(x, y);
        return logical ? { target, entryId, logical } : null;
    }
    // The objectKind of a table.
    static { this.tableKind = 35; }
    // True when a press at (x, y) on the object hitId may land in the entry's text. A table
    // edits one cell at a time, so there the press has to be inside that cell's text.
    _mayHoldTheCaret(partId, entryId, hitId, x, y) {
        const objects = this._cache.get(partId)?.objects;
        if (objects?.get(hitId)?.objectKind !== VectorManager.tableKind)
            return true;
        const text = objects.get(entryId);
        if (text?.x === undefined ||
            text.y === undefined ||
            text.width === undefined ||
            text.height === undefined)
            return false;
        return (x >= text.x &&
            x <= text.x + text.width &&
            y >= text.y &&
            y <= text.y + text.height);
    }
    /// Put the caret where a click at (x, y), in document twips, lands in the edited text, and
    /// drop any selection. hitId is the object at the point, if any. True when the caret moved.
    placeCaretAt(x, y, hitId) {
        const press = this._pressAt(x, y, hitId);
        return (press !== null &&
            this._moveCaret(press.target, press.entryId, press.logical, null));
    }
    /// Select the word under a double click at (x, y), in document twips, as the engine does.
    /// hitId is the object at the point, if any. True when the word is selected.
    selectWordAt(x, y, hitId) {
        return this._selectAt(x, y, hitId, cool.wordAt);
    }
    /// Select the paragraph under a triple click at (x, y), in document twips. hitId is the
    /// object at the point, if any. True when the paragraph is selected.
    selectParagraphAt(x, y, hitId) {
        return this._selectAt(x, y, hitId, cool.paragraphAt);
    }
    // Select the span that extent gives around the caret where a click at (x, y) lands.
    _selectAt(x, y, hitId, extent) {
        const press = this._pressAt(x, y, hitId);
        if (!press)
            return false;
        const { target, entryId, logical } = press;
        const position = target.tree.caretIn(entryId, logical);
        const span = position ? extent(position, logical) : null;
        return (span !== null && this._moveCaret(target, entryId, span.caret, span.anchor));
    }
    /// Start a drag that selects text from a press at (x, y), in document twips. hitId is the
    /// object at the point, if any. True when the caret moved to the press.
    startTextDrag(x, y, hitId) {
        this._dragStart = null;
        const press = this._pressAt(x, y, hitId);
        if (!press ||
            !this._moveCaret(press.target, press.entryId, press.logical, null))
            return false;
        this._dragStart = { entryId: press.entryId, anchor: press.logical };
        return true;
    }
    /// Select the text from where the drag started to the mouse at (x, y), in document twips.
    dragTextTo(x, y) {
        const start = this._dragStart;
        const target = this._caretTarget();
        if (!start || !target)
            return;
        const logical = this._textOf(target.tree, start.entryId)?.caretNearPoint(x, y);
        if (logical)
            this._moveCaret(target, start.entryId, logical, start.anchor);
    }
    endTextDrag() {
        this._dragStart = null;
    }
    // Put the caret at logical in the entry and draw it, with the text from the anchor to it
    // selected. The engine is told later. False when no run shows the position.
    _moveCaret(target, entryId, logical, anchor) {
        const geometry = target.tree.caretIn(entryId, logical)?.geometry();
        if (!geometry)
            return false;
        // An anchor at the caret selects nothing.
        if (anchor && cool.compareCarets(anchor, logical) === 0)
            anchor = null;
        this._travelX = null;
        const partId = target.tree.data.partId;
        LocalCaret.moved({
            partId,
            entryId,
            objectId: this._editedObjectOf(partId, entryId),
            logical,
            anchor,
        });
        app.file.textCursor.logical = { ...logical };
        app.file.textCursor.anchor = anchor ? { ...anchor } : null;
        this._setCaretRectangle(geometry);
        this._showSelection(target.tree, entryId, anchor, logical);
        return true;
    }
    // Draw the selection from the anchor to the caret, or remove it without an anchor.
    _showSelection(tree, entryId, anchor, logical) {
        const documentLayer = this._docLayer;
        if (!anchor) {
            if (TextSelections.isActive())
                documentLayer.showTextSelection([]);
            return;
        }
        const rectangles = this._textOf(tree, entryId)?.selectionRectangles(anchor, logical) ?? [];
        documentLayer.showTextSelection(rectangles.map((rectangle) => [rectangle.x, rectangle.y, rectangle.width, rectangle.height].map(Math.round)));
        // The handles go at the start and the end of the selection, in reading order.
        const [from, to] = cool.compareCarets(anchor, logical) <= 0
            ? [anchor, logical]
            : [logical, anchor];
        const handle = (caret) => {
            const geometry = tree.caretIn(entryId, caret)?.geometry();
            return geometry
                ? new cool.SimpleRectangle(Math.round(geometry.x), Math.round(geometry.top), 0, Math.round(geometry.height))
                : null;
        };
        TextSelections.setStartRectangle(handle(from));
        TextSelections.setEndRectangle(handle(to));
    }
    // Apply an edit at the caret, record it for replay and move the caret. build gets the code
    // points selected before and after the caret in its paragraph, or null without a selection,
    // and returns the change to apply.
    _predictEdit(build) {
        // The engine learns of a caret moved here before the edit, so the edit's number is
        // the one after it.
        LocalCaret.tell();
        const target = this._editTarget(true);
        if (!target)
            return false;
        const position = this._lookUpCaret(target);
        if (!position)
            return false;
        const anchor = this._selectionAnchorInParagraph();
        const selected = anchor ? cool.selectedAround(position, anchor) : null;
        const applied = cool.applyPredictedChange(target.tree, position, target.logical, build(selected));
        if (!applied)
            return false;
        if (target.logical) {
            const caretAfter = {
                paragraph: target.logical.paragraph,
                index: Math.max(0, target.logical.index + applied.indexShift),
                atEnd: applied.position.atEnd,
            };
            this._recordEdit(target.tree.data.partId, position, target.logical, caretAfter, applied.change);
            target.logical.index = caretAfter.index;
        }
        if (selected) {
            // The selection is gone with the text it covered.
            app.file.textCursor.anchor = null;
            if (TextSelections.isActive())
                this._docLayer.showTextSelection([]);
        }
        this._placeCaret(target, applied.caretShift);
        this.changedHere();
        return true;
    }
    // Place the caret at its logical position in the edited tree, so it follows
    // text a re-wrap moved to another line, and redraw it. Without a logical
    // position, slide it along its line by the edit's width. target.caret is
    // the caret before the edit, which finds the edited object in the new tree.
    _placeCaret(target, fallbackShift) {
        if (target.logical) {
            const geometry = this._lookUpCaret(target)?.geometry();
            if (geometry) {
                this._setCaretRectangle(geometry);
                return;
            }
        }
        this._advanceCaret(target.caret, fallbackShift);
    }
    _advanceCaret(caret, shift) {
        if (shift === 0)
            return;
        caret.moveBy([shift, 0]);
        this._docLayer._onUpdateCursor();
    }
    _setCaretRectangle(geometry) {
        cool.showCaret(geometry);
    }
    // The edits of the part.
    static _ofPart(partId) {
        return (edit) => edit.partId === partId;
    }
    // Drop the part's edits and ask for the whole part again, as the cached tree
    // still holds the predicted text. A full response replaces every object,
    // where a delta replaces only those the server changed. The cached tree
    // stays drawn until the response arrives.
    _abandonEdits(partId) {
        this._typedEdits.forget(VectorManager._ofPart(partId));
        const data = this._cache.get(partId);
        if (!data)
            return;
        this._inFlightParts.add(partId);
        this._sendVectorPrimitivesRequest(partId, data.mode);
    }
    // Record an edit for replay until its message is answered. An edit without an object id
    // is not recorded.
    _recordEdit(partId, position, caretBefore, caretAfter, change) {
        const objectId = position.objectId;
        if (objectId === undefined)
            return;
        this._typedEdits.record({
            ticket: cool.InputSequence.ticketForTheNextMessage(),
            partId,
            objectId,
            caretBefore: { ...caretBefore, atEnd: position.atEnd },
            caretAfter,
            ...change,
        });
    }
    // Drop the edits the content includes and replay the rest, only on the
    // replaced objects when given. Content without a sequence drops all of the
    // part's edits. An edit that no longer fits drops them too and re-fetches
    // the part, as the edits replayed before it stay in the tree.
    _reconcile(partId, inputSequence, replaced) {
        const ofPart = VectorManager._ofPart(partId);
        if (!this._typedEdits.has(ofPart))
            return;
        const remaining = this._typedEdits.answered(inputSequence, ofPart);
        const toReplay = replaced
            ? remaining.filter((edit) => replaced.includes(edit.objectId))
            : remaining;
        if (!toReplay.length)
            return;
        const data = this._cache.get(partId);
        if (!data) {
            this._typedEdits.forget(ofPart);
            return;
        }
        const treeChanged = cool.UnansweredEdits.applyAgain(toReplay, (edit) => this._replayEdit(data, edit));
        if (!treeChanged)
            this._abandonEdits(partId);
        if (treeChanged) {
            // The newest edit set the caret, replayed or not, unless the caret moved
            // here after it.
            const newest = remaining[remaining.length - 1];
            const moved = LocalCaret.ahead();
            const caret = moved &&
                moved.caret.partId === partId &&
                moved.sequence > cool.UnansweredEdits.sentAs(newest)
                ? { entryId: moved.caret.entryId, logical: moved.caret.logical }
                : { entryId: newest.objectId, logical: newest.caretAfter };
            const geometry = this._treeOf(data)
                .caretIn(caret.entryId, caret.logical)
                ?.geometry();
            if (geometry)
                this._setCaretRectangle(geometry);
            app.file.textCursor.logical = {
                paragraph: caret.logical.paragraph,
                index: caret.logical.index,
            };
        }
        this.changedHere();
    }
    // Apply a recorded edit. Returns true when the tree changed.
    _replayEdit(data, edit) {
        const position = this._treeOf(data).caretIn(edit.objectId, edit.caretBefore);
        if (!position)
            return false;
        return (cool.applyPredictedChange(this._treeOf(data), position, edit.caretBefore, edit) !== null);
    }
    /// True when the update is older than the newest edit, so the local caret
    /// stays. A current update that puts the caret elsewhere, as after
    /// autocorrect, drops the edits and re-fetches the part.
    keepPredictedCaret(update) {
        // The caret moved here, read before isAhead clears it once the engine has caught
        // up.
        const moved = LocalCaret.ahead();
        if (LocalCaret.isAhead(update))
            return true;
        const partId = this._selectedPartId();
        if (partId === undefined)
            return false;
        const verdict = this._typedEdits.verdictOn(update, 
        // A running edit's entry keeps its id across objects, so compare with the
        // edited object.
        (objectId, newest) => objectId === this._editedObjectOf(partId, newest.objectId), VectorManager._ofPart(partId), 
        // A caret moved here after the newest edit is where the engine's caret
        // answers from.
        (newest) => moved &&
            moved.caret.partId === partId &&
            moved.sequence > cool.UnansweredEdits.sentAs(newest)
            ? moved.caret.logical
            : newest.caretAfter);
        if (verdict === cool.CaretUpdateVerdict.Elsewhere)
            this._abandonEdits(partId);
        return verdict === cool.CaretUpdateVerdict.Older;
    }
    // The edited object: a running edit entry's parent, or the entry itself.
    _editedObjectOf(partId, objectId) {
        const entry = this._cache.get(partId)?.objects.get(objectId);
        return entry?.kind === 'texteditoverlay' && entry.parent !== undefined
            ? entry.parent
            : objectId;
    }
    /// Handle a fetched bitmap: cache it and re-render the previews
    /// that use it. Data that is missing or fails to decode marks
    /// the checksum as unavailable.
    handleVectorRenderingGraphicsResponse(values) {
        this._resources.handleImage(values);
    }
    /*
        A picture the renderer made of a form control has loaded. The view draws again at once,
        and every preview shown once for all the pictures that load at the same moment, as the
        pictures of many controls come in together.
    */
    _onPictureReady() {
        this._fireChanged([]);
        if (this._previewsWaitForPictures)
            return;
        this._previewsWaitForPictures = true;
        app.layoutingService.appendLayoutingTask(() => {
            this._previewsWaitForPictures = false;
            const parts = new Set();
            for (const info of this._renderedPreviews.values())
                parts.add(info.partId);
            for (const partId of parts)
                this._redrawRenderedPreviews(partId);
        });
    }
    _redrawPartsUsing(parts) {
        if (!parts)
            return;
        for (const partId of parts) {
            this._redrawRenderedPreviews(partId);
            // A page draws the objects of its master too, so it shows what the master uses.
            for (const [pageId, data] of this._cache) {
                if (data.masterPartId === partId)
                    this._redrawRenderedPreviews(pageId);
            }
        }
    }
    /// Re-render every preview already shown for a part against its
    /// current cached data, leaving out the ones named.
    _redrawRenderedPreviews(partId, except) {
        const data = this._cache.get(partId);
        if (!data)
            return;
        for (const [id, info] of this._renderedPreviews) {
            if (info.partId !== partId || except?.has(id))
                continue;
            this._renderAndFire(id, info.maxWidth, info.maxHeight, data);
        }
    }
    /// Handle a fetched font: register it as a FontFace under a synthetic
    /// family name and re-render the parts that use it.
    handleVectorRenderingFontResponse(values) {
        this._resources.handleFont(values);
    }
    /// The page list on screen has been replaced, so an index may name
    /// another page than it did. The cache and the requests in flight are
    /// keyed by page id and stay. The change listeners are notified.
    partListChanged() {
        this._missingParts.clear();
        // The list brings no object from the engine, so no object is answered.
        this._fireChanged([]);
    }
    /// Mark every cached part as stale. A client that was away while a part changed has
    /// nothing else that tells it so. The views and the previews in view draw again, and each
    /// stale part they draw asks for the delta since the version held, or a header alone
    /// when nothing changed. A part that is not drawn is not asked for until it is.
    revalidateCachedParts() {
        for (const partId of this._cache.keys())
            this._staleParts.add(partId);
        this._fireChanged([]);
        app.map.fire('vectorcontentstale');
    }
    /// Forget the requests in flight. A request sent before the connection dropped gets no
    /// answer, so the next draw or revalidation asks for the page again.
    forgetRequestsInFlight() {
        this._inFlightParts.clear();
        this._revalidating.clear();
        this._revalidationsWaiting = [];
    }
    /// Drop cached data for a page and any in-flight state, and the bitmaps
    /// no other cached page uses. The predicted edits stay pending.
    clearCachedPart(partId) {
        this._cache.delete(partId);
        this._staleParts.delete(partId);
        this._inFlightParts.delete(partId);
        this._revalidationAnswered(partId);
        this._bitmaps.releasePart(partId);
        this._fonts.forgetPart(partId);
        this._fireChanged();
    }
    /// Drop the cached primitive trees for every part so the views
    /// re-fetch them. Decoded bitmaps stay cached, since an image that
    /// actually changed comes back under a new checksum anyway. The
    /// predicted edits stay pending.
    clearAllParts() {
        this._cache.clear();
        this._staleParts.clear();
        this._inFlightParts.clear();
        this._revalidating.clear();
        this._revalidationsWaiting = [];
        this._resources.forgetOwners();
        this._fireChanged();
    }
    /// Drop the decoded bitmaps and the primitive trees that reference
    /// them, so the next paint re-fetches what it draws. The loaded
    /// fonts stay registered, since they are few and small. The predicted
    /// edits stay pending.
    reclaimGraphicsMemory() {
        this._resources.dropImages();
        this._resources.forgetOwners();
        this._cache.clear();
        this._staleParts.clear();
        this._inFlightParts.clear();
        this._renderer.releaseScratchCanvases();
        this._renderer.releaseColorChangedImages();
        this._fireChanged();
    }
    /// Drop all cached data for all parts.
    discardAllCache() {
        LocalCaret.forget();
        this._cache.clear();
        this._staleParts.clear();
        this._inFlightParts.clear();
        this._pendingPreviews.clear();
        this._typedEdits.forget();
        this._resources.discard();
        this._renderedPreviews.clear();
        this._renderer.releaseScratchCanvases();
        this._renderer.releaseColorChangedImages();
        this._fireChanged();
    }
    /// Draw the previews waiting for a part once the part and the master it
    /// names are both cached. Returns the ids of the previews drawn.
    _drainDrawable(partId) {
        const drawn = new Set();
        const data = this._cache.get(partId);
        if (!data || !this._isDrawable(data))
            return drawn;
        const queue = this._pendingPreviews.get(partId);
        if (!queue)
            return drawn;
        this._pendingPreviews.delete(partId);
        for (const pending of queue) {
            this._renderAndFire(pending.id, pending.maxWidth, pending.maxHeight, data);
            drawn.add(pending.id);
        }
        return drawn;
    }
    /// Render to an offscreen canvas and trigger rendering of the thumbnail.
    _renderAndFire(id, maxWidth, maxHeight, data) {
        if (data.slideWidth <= 0 || data.slideHeight <= 0)
            return;
        this._renderedPreviews.set(id, {
            partId: data.partId,
            mode: data.mode,
            maxWidth: maxWidth,
            maxHeight: maxHeight,
        });
        const pxW = Math.max(1, Math.round(maxWidth * app.roundedDpiScale));
        const pxH = Math.max(1, Math.round(maxHeight * app.roundedDpiScale));
        const canvas = document.createElement('canvas');
        canvas.width = pxW;
        canvas.height = pxH;
        const context = canvas.getContext('2d');
        if (!context)
            return;
        // Twips to canvas pixels.
        context.scale(pxW / data.slideWidth, pxH / data.slideHeight);
        // A master page is only ever looked at while it is being edited, so
        // its thumbnail draws the prompt text of an empty placeholder. A slide
        // stands on its own, and its thumbnail leaves the prompts out.
        this.renderInto(context, data, {
            editView: data.mode === cool.VectorMode.MasterPages,
        });
        const previewImage = new Image();
        previewImage.width = maxWidth;
        previewImage.height = maxHeight;
        previewImage.src = canvas.toDataURL('image/png');
        // The image shows the page with this id, at the index the page list on
        // screen gives it now, or -1 when that list does not hold the page.
        app.map.fire('tilepreview', {
            tile: previewImage,
            id: id,
            width: maxWidth,
            height: maxHeight,
            part: data.partId,
            partIndex: this._indexOf(data.partId, data.mode),
            mode: data.mode,
            docType: this._docLayer._docType,
        });
    }
}

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class VectorCompositor extends SlideCompositor {
    constructor(slideShowPresenter) {
        super(slideShowPresenter);
        this.offscreenCanvas = null;
        this.offscreenContext = null;
        // The 2d render context over the offscreen canvas.
        this.renderContext = null;
        this.videos = new SlideVideos();
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.disposed = false;
        // The listener registered on the render manager, kept to remove it.
        this.onDataChanged = null;
        // The slide the initial fetchAndRun is waiting on, and the callback to
        // fire once its primitive tree is in the cache.
        this.pendingSlideNumber = null;
        this.pendingReady = null;
        // The layers of the slide on the GPU, for each WebGL context that frames are drawn straight
        // into: the one of the slideshow canvas, and the ones of the canvases that show the frames in
        // other windows.
        this.layers = new Map();
    }
    _addHooks() {
        // The shared cache fires this when a tree or an embedded bitmap
        // arrives. Use it to release the initial fetchAndRun once its
        // slide is ready.
        this.onDataChanged = () => this._onDataChanged();
        RenderManager.onVectorChanged(this.onDataChanged);
    }
    removeHooks() {
        if (this.onDataChanged)
            RenderManager.offVectorChanged(this.onDataChanged);
        this.onDataChanged = null;
    }
    onUpdatePresentationInfo() {
        // The videos drew into the old canvas. Entering the slide makes them anew.
        this.videos.deleteResources();
        this.videos.clear();
        [this.canvasWidth, this.canvasHeight] = this._computeCanvasSize();
        this.offscreenCanvas = new OffscreenCanvas(this.canvasWidth, this.canvasHeight);
        this.offscreenContext = this.offscreenCanvas.getContext('2d');
        this.renderContext = new RenderContext2d(this.offscreenCanvas);
        this.layers.forEach((layers) => layers.invalidate());
        // A compositor whose slideshow was closed draws the next one.
        this.disposed = false;
        // The slideshow shows the whole deck, so request every slide's
        // tree at the start.
        this._fetchAllSlides();
    }
    getCanvasSize() {
        return [this.canvasWidth, this.canvasHeight];
    }
    fetchAndRun(slideNumber, callback) {
        super.fetchAndRun(slideNumber, callback);
        // The slide starts once the running code has returned, also when its primitives are
        // cached, so every listener of the presentation info is set up before the first slide
        // starts.
        queueMicrotask(() => {
            if (this.disposed)
                return;
            this._runWhenReady(slideNumber, () => {
                const done = this._onGotSlideCallback;
                this._onGotSlideCallback = null;
                if (done)
                    done.call(this);
            });
        });
    }
    getSlide(slideNumber) {
        return this._composeSlide(slideNumber);
    }
    getAnimatedSlide(slideIndex) {
        // A frame of an effect and the slide itself compose the same way.
        return this._composeSlide(slideIndex);
    }
    // --- fetching ---------------------------------------------------
    _fetchAllSlides() {
        this._metaPresentation.getMetaSlides().forEach((_metaSlide, hash) => {
            const info = this._metaPresentation.getSlideInfo(hash);
            if (info) {
                RenderManager.requestPartById(info.part, cool.VectorMode.Slides);
            }
        });
    }
    /// The id of the page that shows the slide. The slideshow can run from
    /// any view, and the slide info names each slide by its id.
    _partIdForSlide(slideNumber) {
        const hash = this._metaPresentation.getSlideHash(slideNumber);
        return this._partIdForSlideHash(hash);
    }
    _partIdForSlideHash(slideHash) {
        const info = slideHash
            ? this._metaPresentation.getSlideInfo(slideHash)
            : null;
        return info ? info.part : null;
    }
    _runWhenReady(slideNumber, ready) {
        const partId = this._partIdForSlide(slideNumber);
        if (partId !== null &&
            RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides)) {
            ready();
            return;
        }
        this.pendingSlideNumber = slideNumber;
        this.pendingReady = ready;
    }
    _onDataChanged() {
        // A tree or an embedded bitmap that arrives can change what a layer
        // of the slide shows.
        this.layers.forEach((layers) => layers.invalidate());
        if (this.disposed)
            return;
        this._refreshShownSlide();
        if (this.pendingReady === null)
            return;
        const partId = this._partIdForSlide(this.pendingSlideNumber);
        if (partId === null ||
            !RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides))
            return;
        const ready = this.pendingReady;
        this.pendingReady = null;
        this.pendingSlideNumber = null;
        ready();
    }
    // An element without a base takes it from the tree that arrived. Every
    // slide is checked, since a transition enters a slide before it is the
    // one drawn last.
    _refreshShownSlide() {
        this._metaPresentation.getMetaSlides().forEach((_metaSlide, slideHash) => {
            if (!this._drawableData(slideHash))
                return;
            this.getAnimatedElementMap(slideHash)?.forEach((element) => element.refreshContent());
        });
        this._slideShowPresenter._slideRenderer?.requestRender();
    }
    // --- composing --------------------------------------------------
    _composeSlide(slideNumber) {
        if (this.disposed || !this.offscreenContext)
            return null;
        const slideHash = this._metaPresentation.getSlideHash(slideNumber);
        const data = this._drawableData(slideHash);
        if (!data)
            return null;
        const context = this.offscreenContext;
        context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        context.save();
        // Slide twips to canvas pixels. The canvas already carries the
        // slide aspect ratio, so a single scale fits the slide to it.
        context.scale(this.canvasWidth / data.slideWidth, this.canvasHeight / data.slideHeight);
        const states = this._drawStates(slideHash, data);
        // A slideshow shows the document in its own colors.
        RenderManager.renderInto(context, data, { authoredColors: true, states });
        context.restore();
        // The videos are placed on the canvas in pixels, each in the state
        // of its shape.
        this.videos.render(slideHash, (shapeId) => this._videoLook(data, states, shapeId));
        return this.offscreenCanvas.transferToImageBitmap();
    }
    // How the video of the shape is drawn: in the state of the shape.
    // Undefined where no animation moves the shape.
    _videoLook(data, states, shapeId) {
        if (!states)
            return undefined;
        const state = VectorManager.stateOf(data, shapeId, states);
        if (!state)
            return undefined;
        return {
            state,
            slideWidth: data.slideWidth,
            slideHeight: data.slideHeight,
        };
    }
    // The object id of each animation target of the slide, with the positions
    // of the paragraphs of its text that an animation moves on their own. A
    // video counts as a target, so its frame draws in its place in the paint
    // order, unless a group above it is a target and its run holds the video.
    _animatedTargets(slideHash, data) {
        const targets = new Map();
        const elements = this.getAnimatedElementMap(slideHash);
        if (elements) {
            for (const target of elements.keys()) {
                const { id, paragraph } = VectorCompositor._splitTarget(target);
                if (!data.objects.has(id))
                    continue;
                if (!targets.has(id))
                    targets.set(id, []);
                if (paragraph !== undefined)
                    targets.get(id).push(paragraph);
            }
        }
        targets.forEach((paragraphs) => paragraphs.sort((a, b) => a - b));
        for (const video of this._metaPresentation.getSlideInfo(slideHash)
            ?.videos ?? []) {
            const id = video.id;
            if (!data.objects.has(id) || targets.has(id))
                continue;
            let above = data.objects.get(id)?.parent;
            while (above !== undefined && !targets.has(above))
                above = data.objects.get(above)?.parent;
            if (above === undefined)
                targets.set(id, []);
        }
        return targets;
    }
    // The frame each video shows now, by the object id of its shape. A video
    // without a frame yet leaves its placeholder showing.
    _videoFrames(slideHash, data) {
        const frames = new Map();
        for (const video of this._metaPresentation.getSlideInfo(slideHash)
            ?.videos ?? []) {
            if (!data.objects.has(video.id))
                continue;
            const frame = this.videos.get(slideHash, video)?.currentFrame();
            if (frame)
                frames.set(video.id, frame);
        }
        return frames;
    }
    drawsFrames() {
        return !this.disposed;
    }
    drawFrameInto(context, slideIndex, texture) {
        if (this.disposed || context.isDisposed())
            return false;
        const slideHash = this._metaPresentation.getSlideHash(slideIndex);
        const data = this._drawableData(slideHash);
        if (!data)
            return false;
        // The layers of a context that is gone are freed with it.
        this.layers.forEach((layers, owner) => {
            if (!owner.isDisposed())
                return;
            layers.dispose();
            this.layers.delete(owner);
        });
        let layers = this.layers.get(context);
        if (!layers) {
            layers = new VectorSlideLayers(context);
            this.layers.set(context, layers);
        }
        // The layers are drawn at the size of the canvas of the context, so the text on a smaller
        // canvas is drawn for its own size.
        const width = context.canvas.width;
        const height = context.canvas.height;
        if (width <= 0 || height <= 0)
            return false;
        if (!layers.holds(slideHash, data, width, height))
            layers.build(slideHash, data, this._animatedTargets(slideHash, data), width, height);
        return layers.draw(this._drawStates(slideHash, data), texture, this._videoFrames(slideHash, data));
    }
    /// The cached tree of the slide, or null until the slide and its master,
    /// which holds the background and footers, have arrived.
    _drawableData(slideHash) {
        const partId = this._partIdForSlideHash(slideHash);
        if (partId === null)
            return null;
        if (!RenderManager.isPartDrawableById(partId, cool.VectorMode.Slides))
            return null;
        const data = RenderManager.requestPartById(partId, cool.VectorMode.Slides);
        if (!data || data.slideWidth <= 0 || data.slideHeight <= 0)
            return null;
        return data;
    }
    // The state of every animated target by object id. A paragraph target
    // is the shape id, an underscore and the paragraph position. A target
    // without a base rectangle is drawn as it comes.
    _drawStates(slideHash, data) {
        const elements = this.getAnimatedElementMap(slideHash);
        if (!elements || elements.size === 0)
            return undefined;
        const states = new Map();
        elements.forEach((element, target) => {
            if (!element.isValid())
                return;
            const { id: objectId, paragraph } = VectorCompositor._splitTarget(target);
            if (!data.objects.has(objectId))
                return;
            let state = states.get(objectId);
            if (!state) {
                state = {};
                states.set(objectId, state);
            }
            const drawState = element.getDrawState();
            if (paragraph === undefined) {
                Object.assign(state, drawState);
            }
            else {
                if (!state.paragraphs)
                    state.paragraphs = new Map();
                state.paragraphs.set(paragraph, drawState);
            }
        });
        return states;
    }
    // A shape target is its object id, a paragraph target the id, an
    // underscore and the paragraph position.
    static _splitTarget(target) {
        const separator = target.indexOf('_');
        if (separator < 0)
            return { id: Number(target), paragraph: undefined };
        return {
            id: Number(target.substring(0, separator)),
            paragraph: Number(target.substring(separator + 1)),
        };
    }
    // --- animation and video ----------------------------------------
    createAnimatedElement(sId, slideHash, title, slideWidth, slideHeight, bIsTextElement) {
        return new AnimatedElementVector(this, sId, slideHash, title, slideWidth, slideHeight, bIsTextElement);
    }
    getAnimatedLayerInfo(_slideHash, _targetElement) {
        return null;
    }
    getLayerImage(_slideHash, _targetElement) {
        return null;
    }
    /// The box of the shape or the bounds of the paragraph, in twips. Null
    /// without a cached tree or such a target.
    getLayerBounds(slideHash, targetElement) {
        const target = this._findTarget(slideHash, targetElement);
        if (!target)
            return null;
        if (target.paragraph) {
            const bounds = target.paragraph.bounds;
            if (!bounds)
                return null;
            return new DOMRect(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]);
        }
        const object = target.object;
        if (object.x === undefined || object.width === undefined)
            return null;
        return new DOMRect(object.x, object.y, object.width, object.height);
    }
    /// The target's colors as #rrggbb: the solid fill and line of the shape,
    /// and the color of the first text run, of its own paragraph for a
    /// paragraph target. Absent where there is none or it is automatic. Null
    /// without a cached tree or such a target.
    getTargetColors(slideHash, targetElement) {
        const target = this._findTarget(slideHash, targetElement);
        if (!target)
            return null;
        const text = target.paragraph
            ? [target.paragraph]
            : cool.TextHierarchyParagraphPrimitive.collect(target.object.primitives);
        return {
            fillColor: target.object.properties?.fillColor,
            lineColor: target.object.properties?.lineColor,
            fontColor: VectorCompositor._firstFontColor(target.data, text),
        };
    }
    // The object the target names, its paragraph for a paragraph target,
    // and the cached part. Null without a cached tree or such an object.
    _findTarget(slideHash, targetElement) {
        const partId = this._partIdForSlideHash(slideHash);
        if (partId === null)
            return null;
        const data = RenderManager.requestPartById(partId, cool.VectorMode.Slides);
        if (!data)
            return null;
        const { id, paragraph } = VectorCompositor._splitTarget(targetElement);
        const object = data.objects.get(id);
        if (!object)
            return null;
        if (paragraph === undefined)
            return { data, object };
        const paragraphNode = cool.TextHierarchyParagraphPrimitive.collect(object.primitives)[paragraph];
        return paragraphNode ? { data, object, paragraph: paragraphNode } : null;
    }
    // The color of the first text run, automatic resolved against the
    // surface under it, or undefined without text.
    static _firstFontColor(data, primitives) {
        if (!primitives)
            return undefined;
        for (const primitive of primitives) {
            if (primitive.type === cool.TextSimplePortionPrimitive.type ||
                primitive.type === cool.TextDecoratedPortionPrimitive.type)
                return RenderManager.textColorOf(data, primitive);
            const found = VectorCompositor._firstFontColor(data, primitive.children);
            if (found)
                return found;
        }
        return undefined;
    }
    getLayerRendererContext() {
        return null;
    }
    getVideoRenderer(slideHash, videoInfo) {
        return this.videos.get(slideHash, videoInfo);
    }
    pauseVideos(slideHash) {
        this.videos.pause(slideHash);
    }
    // --- transitions and lifecycle ----------------------------------
    notifyTransitionStart() {
        // The primitive trees are already cached, so there is nothing to
        // hold back while a transition runs.
    }
    notifyTransitionEnd(slideHash) {
        if (this.disposed || !this.renderContext)
            return;
        this.videos.enterSlide(slideHash, this._metaPresentation.getSlideInfo(slideHash), this.renderContext);
    }
    deleteResources() {
        this.disposed = true;
        this.videos.deleteResources();
        this.videos.clear();
        this.offscreenCanvas = null;
        this.offscreenContext = null;
        this.renderContext = null;
        this.layers.forEach((layers) => layers.dispose());
        this.layers.clear();
        this.pendingReady = null;
        this.pendingSlideNumber = null;
    }
    // --- canvas sizing ----------------------------------------------
    // Primitives render at any scale, so the resolution is the requested size in device pixels.
    computeLayerResolution(width, height) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        return [width * devicePixelRatio, height * devicePixelRatio];
    }
    // The canvas takes the display resolution, fitted to the slide aspect ratio.
    _computeCanvasSize() {
        const [width, height] = this.computeLayerResolution(window.screen.width, window.screen.height);
        return this.computeLayerSize(width, height);
    }
}
SlideShow.VectorCompositor = VectorCompositor;

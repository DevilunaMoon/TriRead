// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class LayerDrawing {
    constructor(mapObj, helper) {
        this.map = null;
        this.slideCache = new SlideCache();
        this.compressedSlideCache = new Map();
        this.compressedPrefetchSlideHash = null;
        this.requestedSlideHash = null;
        this.prefetchedSlideHash = null;
        this.nextRequestedSlideHash = null;
        this.nextPrefetchedSlideHash = null;
        this.slideRequestTimeout = null;
        this.resolutionWidth = 960;
        this.resolutionHeight = 540;
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.backgroundChecksums = new Map();
        this.cachedBackgrounds = new Map();
        this.cachedMasterPages = new Map();
        this.cachedDrawPages = new Map();
        this.cachedTextFields = new Map();
        this.slideTextFieldsMap = new Map();
        this.offscreenCanvas = null;
        this.onSlideRenderingCompleteCallback = null;
        this.videos = new SlideVideos();
        this.gifRenderers = new Map();
        this.isTransitionActive = false;
        this.queuedLayers = [];
        this.isDecompressing = false;
        this.decompressionQueue = [];
        this.completionQueue = [];
        this.map = mapObj;
        this.helper = helper;
    }
    addHooks() {
        this.map.on('slidelayer', this.onSlideLayerMsg, this);
        this.map.on('sliderenderingcomplete', this.onSlideRenderingComplete, this);
        this.map.on('compressedslide', this.onCompressSlide, this);
    }
    removeHooks() {
        this.map.off('slidelayer', this.onSlideLayerMsg, this);
        this.map.off('sliderenderingcomplete', this.onSlideRenderingComplete, this);
        this.map.off('compressedslide', this.onCompressSlide, this);
    }
    onCompressSlide(e) {
        app.console.log(`CompressedCache: Storing compressed slide in LayerDrawing cache - slideHash: ${e.slideHash}, layers: ${e.layers.length}`);
        this.compressedSlideCache.set(e.slideHash, e.layers);
    }
    isDisposed() {
        return this.layerRenderer && this.layerRenderer.isDisposed();
    }
    deleteResources() {
        this.requestedSlideHash = null;
        this.prefetchedSlideHash = null;
        this.nextRequestedSlideHash = null;
        this.nextPrefetchedSlideHash = null;
        this.videos.deleteResources();
        this.deleteGifsResources();
        this.layerRenderer.dispose();
        this.compressedSlideCache.clear();
    }
    getSlideInfo(slideHash) {
        return this.helper.getSlideInfo(slideHash);
    }
    getDocWidth() {
        return this.helper.getDocWidth();
    }
    getDocHeight() {
        return this.helper.getDocHeight();
    }
    setDocWidth(slideWidth) {
        this.helper.setDocWidth(slideWidth);
    }
    setDocHeight(slideHeight) {
        this.helper.setDocHeight(slideHeight);
    }
    getSlide(slideNumber) {
        const startSlideHash = this.helper.getSlideHash(slideNumber);
        return this.slideCache.get(startSlideHash);
    }
    getLayerBounds(slideHash, targetElement) {
        const layers = this.cachedDrawPages.get(slideHash);
        if (!layers)
            return null;
        for (const i in layers) {
            const animatedInfo = layers[i].content;
            if (animatedInfo &&
                animatedInfo.hash === targetElement &&
                animatedInfo.content)
                return animatedInfo.bounds;
        }
        return null;
    }
    getAnimatedSlide(slideIndex) {
        app.console.debug('LayerDrawing.getAnimatedSlide: slide index: ' + slideIndex);
        const slideHash = this.helper.getSlideHash(slideIndex);
        this.composeLayers(slideHash);
        return this.offscreenCanvas.transferToImageBitmap();
    }
    composeLayers(slideHash) {
        if (this.isDisposed())
            return;
        this.drawBackground(slideHash);
        this.drawMasterPage(slideHash);
        this.drawTextField(slideHash);
        this.drawDrawPage(slideHash);
        this.videos.render(slideHash, (shapeId) => this.videoLook(slideHash, shapeId));
        this.drawGifs(slideHash);
    }
    pauseVideos(slideHash) {
        this.videos.pause(slideHash);
    }
    getVideoRenderer(slideHash, videoInfo) {
        return this.videos.get(slideHash, videoInfo);
    }
    handleGifs(slideHash) {
        if (!GifFrameSource.isSupported()) {
            app.console.warn('LayerDrawing: ImageDecoder not available, GIFs will not animate');
            return;
        }
        const slideInfo = this.getSlideInfo(slideHash);
        const gifsInfo = slideInfo.gifs;
        if (!gifsInfo || gifsInfo.length === 0)
            return;
        this.gifRenderers.set(slideHash, []);
        for (let i = 0; i < gifsInfo.length; ++i) {
            this.handleGif(i, slideHash, gifsInfo[i]);
        }
    }
    handleGif(index, slideHash, gifInfo) {
        if (!GifFrameSource.isSupported())
            return;
        const slideShowPresenter = app.map.slideShowPresenter;
        const slideRenderer = slideShowPresenter._slideRenderer;
        const metaPres = slideShowPresenter._metaPresentation;
        const gifId = slideHash + 'gif' + index;
        const gifRenderer = makeGifRenderer(gifId, this.layerRenderer.getRenderContext(), slideRenderer);
        gifRenderer.prepare(gifInfo, metaPres.docWidth, metaPres.docHeight);
        this.gifRenderers.get(slideHash).push(gifRenderer);
    }
    drawGifs(slideHash) {
        if (!GifFrameSource.isSupported())
            return;
        const gifRenderers = this.gifRenderers.get(slideHash);
        if (!gifRenderers)
            return;
        for (const gifRenderer of gifRenderers) {
            gifRenderer.render();
        }
    }
    loadGifs(slideHash) {
        if (!GifFrameSource.isSupported())
            return;
        const gifRenderers = this.gifRenderers.get(slideHash);
        if (!gifRenderers)
            return;
        for (const gifRenderer of gifRenderers) {
            gifRenderer.load();
        }
    }
    deleteGifsResources() {
        if (!GifFrameSource.isSupported())
            return;
        this.gifRenderers.forEach((gifRenderers) => {
            for (const gifRenderer of gifRenderers) {
                gifRenderer.deleteResources();
            }
        });
    }
    getAnimatedLayerInfo(slideHash, targetElement) {
        app.console.debug(`LayerDrawing.getAnimatedLayerInfo(${slideHash}, ${targetElement})`);
        const layers = this.cachedDrawPages.get(slideHash);
        if (!layers)
            return null;
        for (const i in layers) {
            const animatedInfo = layers[i].content;
            if (animatedInfo && animatedInfo.hash === targetElement)
                return animatedInfo;
        }
        return null;
    }
    getLayerImage(slideHash, targetElement) {
        const layers = this.cachedDrawPages.get(slideHash);
        if (!layers)
            return null;
        for (const i in layers) {
            const animatedInfo = layers[i].content;
            if (animatedInfo &&
                animatedInfo.hash === targetElement &&
                animatedInfo.content)
                return animatedInfo.content.data;
        }
        return null;
    }
    invalidateAll() {
        this.slideCache.invalidateAll();
        this.slideTextFieldsMap.clear();
        this.cachedTextFields.clear();
        this.cachedBackgrounds.clear();
        this.cachedMasterPages.clear();
        this.cachedDrawPages.clear();
        this.videos.clear();
        this.compressedSlideCache.clear();
    }
    getCanvasSize() {
        return [this.canvasWidth, this.canvasHeight];
    }
    onUpdatePresentationInfo() {
        this.computeInitialResolution();
        this.initializeCanvas();
    }
    requestSlide(slideNumber, callback) {
        this.onSlideRenderingCompleteCallback = callback;
        const startSlideHash = this.helper.getSlideHash(slideNumber);
        this.requestSlideImpl(startSlideHash);
    }
    initializeCanvas() {
        this.computeCanvasSize(this.resolutionWidth, this.resolutionHeight);
        this.createRenderingCanvas();
    }
    createRenderingCanvas() {
        this.offscreenCanvas = new OffscreenCanvas(this.canvasWidth, this.canvasHeight);
        try {
            this.layerRenderer = new SlideShow.LayerRendererGl(this.offscreenCanvas);
        }
        catch (error) {
            app.console.log('LayerDrawing: WebGl offscreen rendering not supported');
            this.layerRenderer = new SlideShow.LayerRenderer2d(this.offscreenCanvas);
        }
    }
    requestSlideImpl(slideHash, prefetch = false, compressedLayers = false) {
        if (this.isDisposed())
            return;
        app.console.debug('LayerDrawing.requestSlideImpl: slide hash: ' +
            slideHash +
            ', prefetching: ' +
            prefetch);
        const slideInfo = this.getSlideInfo(slideHash);
        if (!slideInfo) {
            window.app.console.log('LayerDrawing.requestSlideImpl: No info for requested slide: hash: ' +
                slideHash);
            return;
        }
        if (slideHash === this.requestedSlideHash ||
            slideHash === this.prefetchedSlideHash ||
            slideHash === this.nextRequestedSlideHash ||
            slideHash === this.nextPrefetchedSlideHash) {
            // A non-prefetch request for a slide that is already being
            // prefetched: upgrade to a regular request so the callback
            // fires when the data arrives.
            if (!prefetch && slideHash === this.prefetchedSlideHash) {
                this.requestedSlideHash = this.prefetchedSlideHash;
                this.prefetchedSlideHash = null;
            }
            app.console.debug('LayerDrawing.requestSlideImpl: no need to fetch slide again');
            return;
        }
        if (this.requestedSlideHash ||
            this.prefetchedSlideHash ||
            this.slideRequestTimeout) {
            if (!prefetch || !this.slideRequestTimeout) {
                if (!prefetch) {
                    // maybe user has switched to a new slide
                    clearTimeout(this.slideRequestTimeout);
                    this.nextRequestedSlideHash = slideHash;
                    this.nextPrefetchedSlideHash = null;
                }
                else {
                    // prefetching and nothing already queued
                    this.nextPrefetchedSlideHash = slideHash;
                }
                this.slideRequestTimeout = setTimeout(() => {
                    if (!this.helper.isSlideShowPlaying())
                        return;
                    this.slideRequestTimeout = null;
                    this.nextRequestedSlideHash = null;
                    this.nextPrefetchedSlideHash = null;
                    this.requestSlideImpl(slideHash, prefetch);
                }, 500);
            }
            return;
        }
        if (prefetch) {
            this.prefetchedSlideHash = slideHash;
            this.requestedSlideHash = null;
        }
        else {
            this.requestedSlideHash = slideHash;
            this.prefetchedSlideHash = null;
        }
        if (this.slideCache.has(slideHash)) {
            this.onSlideRenderingComplete({ success: true });
            return;
        }
        if (this.compressedSlideCache.has(slideHash)) {
            app.console.log('CompressedCache: fetching slides from CompressedCache, SlideHash :', slideHash);
            SlideBitmapManager.renderCachedCompressedSlide(this.compressedSlideCache.get(slideHash));
            return;
        }
        this.requestSlideFromServer(slideInfo, prefetch, compressedLayers);
    }
    requestSlideFromServer(slideInfo, prefetch = false, compressedLayers = false) {
        if (slideInfo.slideWidth > this.getDocWidth() ||
            slideInfo.slideHeight > this.getDocHeight()) {
            this.setDocWidth(slideInfo.slideWidth);
            this.setDocHeight(slideInfo.slideHeight);
            this.onUpdatePresentationInfo();
        }
        const slideHash = slideInfo.hash;
        const backgroundRendered = this.drawBackground(slideHash);
        const masterPageRendered = this.drawMasterPage(slideHash);
        if (backgroundRendered && masterPageRendered) {
            if (this.drawDrawPage(slideHash)) {
                this.onSlideRenderingComplete({ success: true });
                return;
            }
        }
        if (!prefetch)
            this.map.fire('handleslideshowprogressbar', { isVisible: true });
        app.socket.sendMessage(`getslide hash=${slideInfo.hash} part=${slideInfo.part} width=${this.canvasWidth} height=${this.canvasHeight} ` +
            `renderBackground=${backgroundRendered ? 0 : 1} renderMasterPage=${masterPageRendered ? 0 : 1} devicePixelRatio=${window.devicePixelRatio} compressedLayers=${compressedLayers ? 1 : 0}`);
    }
    onSlideLayerMsg(e) {
        if (this.isDisposed())
            return;
        if (this.isTransitionActive) {
            this.queuedLayers.push(e);
            return;
        }
        if (this.isDecompressing) {
            this.decompressionQueue.push(e);
            return;
        }
        const info = e.message;
        if (!info) {
            window.app.console.log('LayerDrawing.onSlideLayerMsg: no json data available.');
            return;
        }
        if (!this.getSlideInfo(info.slideHash)) {
            window.app.console.log('LayerDrawing.onSlideLayerMsg: no slide info available for ' +
                info.slideHash +
                '.');
            return;
        }
        if (!info.content) {
            window.app.console.log('LayerDrawing.onSlideLayerMsg: no layer content available.');
            return;
        }
        if (e.imgBytes) {
            const promise = SlideBitmapManager.decompressSlideLayer(info, e.imgBytes);
            if (promise) {
                this.isDecompressing = true;
                promise
                    .then((img) => {
                    this.handleMsg(info, img);
                })
                    .finally(() => {
                    this.isDecompressing = false;
                    while (this.decompressionQueue.length) {
                        this.onSlideLayerMsg(this.decompressionQueue.shift());
                        if (this.isDecompressing)
                            return;
                    }
                    while (this.completionQueue.length)
                        this.onSlideRenderingComplete(this.completionQueue.shift());
                });
            }
            return;
        }
        else
            this.handleMsg(info, e.image);
    }
    handleMsg(info, img) {
        switch (info.group) {
            case 'Background':
                this.handleBackgroundMsg(info, img);
                break;
            case 'MasterPage':
                this.handleMasterPageLayerMsg(info, img);
                break;
            case 'DrawPage':
                this.handleDrawPageLayerMsg(info, img);
                break;
            case 'TextFields':
                this.handleTextFieldMsg(info, img);
        }
    }
    handleTextFieldMsg(info, img) {
        const textFieldInfo = info.content;
        const imageInfo = textFieldInfo.content;
        if (!this.checkAndAttachImageData(imageInfo, img))
            return;
        let textFields = this.slideTextFieldsMap.get(info.slideHash);
        if (!textFields) {
            textFields = new Map();
            this.slideTextFieldsMap.set(info.slideHash, textFields);
        }
        textFields.set(textFieldInfo.hash, imageInfo.checksum);
        this.cachedTextFields.set(imageInfo.checksum, textFieldInfo);
    }
    handleBackgroundMsg(info, img) {
        const slideInfo = this.getSlideInfo(info.slideHash);
        if (!slideInfo.background) {
            return;
        }
        if (info.type === 'bitmap') {
            const imageInfo = info.content;
            if (!this.checkAndAttachImageData(imageInfo, img))
                return;
            const pageHash = slideInfo.background.isCustom
                ? info.slideHash
                : slideInfo.masterPage;
            this.backgroundChecksums.set(pageHash, imageInfo.checksum);
            this.cachedBackgrounds.set(imageInfo.checksum, imageInfo);
            this.clearCanvas();
            this.drawBitmap(imageInfo);
        }
    }
    handleMasterPageLayerMsg(info, img) {
        const slideInfo = this.getSlideInfo(info.slideHash);
        if (!slideInfo.masterPageObjectsVisibility) {
            return;
        }
        if (info.index === 0 || !this.cachedMasterPages.get(slideInfo.masterPage))
            this.cachedMasterPages.set(slideInfo.masterPage, new Array());
        const layers = this.cachedMasterPages.get(slideInfo.masterPage);
        if (layers.length !== info.index) {
            window.app.console.log('LayerDrawing.handleMasterPageLayerMsg: missed any layers ?');
        }
        const layerEntry = {
            type: info.type,
            content: info.content,
            isField: info.isField,
        };
        if (info.type === 'bitmap') {
            if (!this.checkAndAttachImageData(layerEntry.content, img))
                return;
        }
        layers.push(layerEntry);
        this.drawMasterPageLayer(layerEntry, info.slideHash);
    }
    handleDrawPageLayerMsg(info, img) {
        if (info.index === 0 || !this.cachedDrawPages.get(info.slideHash)) {
            this.cachedDrawPages.set(info.slideHash, new Array());
        }
        const layers = this.cachedDrawPages.get(info.slideHash);
        if (layers.length !== info.index) {
            window.app.console.log('LayerDrawing.handleDrawPageLayerMsg: missed any layers ?');
        }
        const layerEntry = {
            type: info.type,
            content: info.content,
        };
        if (info.type === 'bitmap') {
            if (!this.checkAndAttachImageData(layerEntry.content, img))
                return;
        }
        else if (info.type === 'animated') {
            const content = layerEntry.content;
            if (content.type === 'bitmap') {
                if (!this.checkAndAttachImageData(content.content, img))
                    return;
                const animatedElement = this.helper.getAnimatedElement(info.slideHash, content.hash);
                if (animatedElement) {
                    animatedElement.updateAnimationInfo(content);
                }
            }
        }
        layers.push(layerEntry);
        this.drawDrawPageLayer(info.slideHash, layerEntry);
    }
    clearCanvas() {
        this.layerRenderer.clearCanvas();
    }
    drawBackground(slideHash) {
        this.clearCanvas();
        const slideInfo = this.getSlideInfo(slideHash);
        if (this.layerRenderer.fillColor(slideInfo))
            return true;
        const pageHash = slideInfo.background.isCustom
            ? slideHash
            : slideInfo.masterPage;
        const checksum = this.backgroundChecksums.get(pageHash);
        if (!checksum)
            return false;
        const imageInfo = this.cachedBackgrounds.get(checksum);
        if (!imageInfo) {
            window.app.console.log('LayerDrawing: no cached background for slide: ' + slideHash);
            return false;
        }
        this.drawBitmap(imageInfo);
        return true;
    }
    drawMasterPage(slideHash) {
        const slideInfo = this.getSlideInfo(slideHash);
        if (!slideInfo.masterPageObjectsVisibility)
            return true;
        const layers = this.cachedMasterPages.get(slideInfo.masterPage);
        if (!layers || layers.length === 0) {
            window.app.console.log('LayerDrawing: No layer cached for master page: ' +
                slideInfo.masterPage);
            return false;
        }
        for (const layer of layers) {
            this.drawMasterPageLayer(layer, slideHash);
        }
        return true;
    }
    drawMasterPageLayer(layer, slideHash) {
        if (layer.type === 'bitmap') {
            this.drawBitmap(layer.content);
        }
        else if (layer.type === 'placeholder') {
            const placeholder = layer.content;
            const slideTextFields = this.slideTextFieldsMap.get(slideHash);
            const checksum = slideTextFields
                ? slideTextFields.get(placeholder.hash)
                : null;
            if (!checksum) {
                window.app.console.log('LayerDrawing: No content found for text field placeholder, type: ' +
                    placeholder.type);
                return;
            }
            const imageInfo = this.cachedTextFields.get(checksum).content;
            this.drawBitmap(imageInfo);
        }
    }
    drawDrawPage(slideHash) {
        const slideInfo = this.getSlideInfo(slideHash);
        if (slideInfo.empty) {
            return true;
        }
        const layers = this.cachedDrawPages.get(slideHash);
        if (!layers || layers.length === 0) {
            window.app.console.log('LayerDrawing: No layer cached for draw page: ' + slideHash);
            return false;
        }
        for (const layer of layers) {
            this.drawDrawPageLayer(slideHash, layer);
        }
        return true;
    }
    drawTextField(slideHash) {
        const slideInfo = this.getSlideInfo(slideHash);
        if (slideInfo.empty) {
            return true;
        }
        const fields = this.slideTextFieldsMap.get(slideHash);
        if (!fields) {
            window.app.console.log('LayerDrawing: No layer cached text field for draw page: ' + slideHash);
            return false;
        }
        for (const field of fields) {
            const imageInfo = this.cachedTextFields.get(field[1]).content;
            this.drawBitmap(imageInfo);
        }
        return true;
    }
    // How the video of the shape is drawn: in the state of the shape's
    // animated element. Undefined where no animation targets the shape.
    videoLook(slideHash, shapeId) {
        const animatedElement = this.helper.getAnimatedElement(slideHash, String(shapeId));
        if (!animatedElement || !animatedElement.isValid())
            return undefined;
        return {
            state: animatedElement.getDrawState(),
            slideWidth: this.getDocWidth(),
            slideHeight: this.getDocHeight(),
        };
    }
    drawDrawPageLayer(slideHash, layer) {
        if (layer.type === 'bitmap') {
            this.drawBitmap(layer.content);
        }
        else if (layer.type === 'animated') {
            const content = layer.content;
            if (content.type === 'bitmap') {
                const animatedElement = this.helper.getAnimatedElement(slideHash, content.hash);
                if (animatedElement) {
                    app.console.debug('LayerDrawing.drawDrawPageLayer: retrieved animatedElement');
                    if (animatedElement.isValid()) {
                        animatedElement.renderLayer(this.layerRenderer);
                        return;
                    }
                }
                this.drawBitmap(content.content);
            }
        }
    }
    drawBitmap(imageInfo) {
        this.layerRenderer.drawBitmap(imageInfo);
    }
    onSlideRenderingComplete(e) {
        if (this.isDisposed())
            return;
        if (this.isDecompressing) {
            this.completionQueue.push(e);
            return;
        }
        if (e.message) {
            const promise = SlideBitmapManager.waitForSlideDecompression(e.message);
            if (promise) {
                promise.then(() => {
                    app.map.fire('sliderenderingcomplete', {
                        success: e.success,
                        compressedLayers: e.message.compressedLayers,
                    });
                });
                return;
            }
        }
        this.map.fire('handleslideshowprogressbar', { isVisible: false });
        const slideHash = this.requestedSlideHash || this.prefetchedSlideHash;
        const slideInfo = this.getSlideInfo(slideHash);
        const index = slideInfo ? slideInfo.index : undefined;
        if (!e.success) {
            this.requestedSlideHash = null;
            this.prefetchedSlideHash = null;
            app.console.debug('LayerDrawing.onSlideRenderingComplete: rendering failed for slide: ' +
                index);
            return;
        }
        if (this.prefetchedSlideHash) {
            var currSlideHash = this.prefetchedSlideHash;
            this.prefetchedSlideHash = null;
            if (e.compressedLayers) {
                this.compressedPrefetchSlideHash = currSlideHash;
                this.prefetchNextCompressedSlide();
            }
            return;
        }
        if (e.compressedLayers) {
            this.prefetchNextCompressedSlide();
            return;
        }
        const reqSlideInfo = this.getSlideInfo(this.requestedSlideHash);
        this.cacheAndNotify();
        // fetch next slide and draw it on offscreen canvas
        if (reqSlideInfo?.next && !this.slideCache.has(reqSlideInfo.next)) {
            this.requestSlideImpl(reqSlideInfo.next, true);
        }
    }
    cacheAndNotify() {
        if (!this.offscreenCanvas) {
            window.app.console.log('LayerDrawing.onSlideRenderingComplete: no offscreen canvas available.');
            return;
        }
        if (!this.slideCache.has(this.requestedSlideHash)) {
            const renderedSlide = this.offscreenCanvas.transferToImageBitmap();
            this.slideCache.set(this.requestedSlideHash, renderedSlide);
        }
        this.compressedSlideCache.delete(this.requestedSlideHash);
        this.requestedSlideHash = null;
        const oldCallback = this.onSlideRenderingCompleteCallback;
        this.onSlideRenderingCompleteCallback = null;
        if (oldCallback)
            // if we already closed presentation it is missing
            oldCallback.call(this.helper);
    }
    prefetchNextCompressedSlide() {
        if (this.compressedPrefetchSlideHash) {
            const slideInfo = this.getSlideInfo(this.compressedPrefetchSlideHash);
            this.compressedPrefetchSlideHash = null;
            if (slideInfo?.next) {
                this.prefetchCompressedSlide(slideInfo.next);
            }
        }
    }
    prefetchCompressedSlide(slideHash) {
        const slideInfo = this.getSlideInfo(slideHash);
        if (!slideInfo) {
            app.console.warn(`SlideInfo not found for hash: ${slideHash}`);
            return;
        }
        if (this.isSlideAlreadyCached(slideHash)) {
            this.prefetchNextSlide(slideInfo);
            return;
        }
        this.compressedPrefetchSlideHash = slideHash;
        this.requestSlideFromServer(slideInfo, true, true);
        return;
    }
    isSlideAlreadyCached(slideHash) {
        return (this.slideCache.has(slideHash) || this.compressedSlideCache.has(slideHash));
    }
    prefetchNextSlide(slideInfo) {
        if (slideInfo.next) {
            this.prefetchCompressedSlide(slideInfo.next);
        }
    }
    checkAndAttachImageData(imageInfo, img) {
        if (!img || (imageInfo.type === 'png' && !img.src)) {
            window.app.console.log('LayerDrawing.checkAndAttachImageData: no bitmap available.');
            return false;
        }
        imageInfo.data = img;
        return true;
    }
    computeInitialResolution() {
        // window.screen dimensions are in CSS pixels; multiply by DPR so the
        // tier selection matches the display's physical pixels and the canvas
        // backing store isn't upscaled by CSS on HiDPI screens.
        const dpr = window.devicePixelRatio || 1;
        const viewWidth = window.screen.width * dpr;
        const viewHeight = window.screen.height * dpr;
        this.computeResolution(viewWidth, viewHeight);
    }
    computeResolution(viewWidth, viewHeight) {
        [this.resolutionWidth, this.resolutionHeight] =
            this.helper.computeLayerResolution(viewWidth, viewHeight);
    }
    computeCanvasSize(resWidth, resHeight) {
        [this.canvasWidth, this.canvasHeight] = this.helper.computeLayerSize(resWidth, resHeight);
    }
    getLayerRendererContext() {
        return this.layerRenderer.getRenderContext();
    }
    notifyTransitionStart() {
        this.isTransitionActive = true;
        this.queuedLayers = [];
    }
    notifyTransitionEnd(slideHash) {
        this.isTransitionActive = false;
        while (this.queuedLayers.length > 0) {
            const layer = this.queuedLayers.shift();
            this.onSlideLayerMsg(layer);
        }
        this.videos.enterSlide(slideHash, this.getSlideInfo(slideHash), this.layerRenderer.getRenderContext());
        this.handleGifs(slideHash);
        if (this.gifRenderers.has(slideHash)) {
            this.loadGifs(slideHash);
        }
    }
}
SlideShow.LayerDrawing = LayerDrawing;

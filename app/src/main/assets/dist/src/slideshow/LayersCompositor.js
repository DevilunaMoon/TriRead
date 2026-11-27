// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class LayersCompositor extends SlideCompositor {
    constructor(slideShowPresenter) {
        super(slideShowPresenter);
    }
    _addHooks() {
        this.layerDrawing = new SlideShow.LayerDrawing(app.map, this);
        this.layerDrawing.addHooks();
    }
    removeHooks() {
        this.layerDrawing.removeHooks();
    }
    fetchAndRun(slideNumber, callback) {
        super.fetchAndRun(slideNumber, callback);
        this.layerDrawing.requestSlide(this._initialSlideNumber, () => {
            const oldCallback = this._onGotSlideCallback;
            this._onGotSlideCallback = null;
            oldCallback();
        });
    }
    getSlideInfo(slideHash) {
        return this._metaPresentation.getSlideInfo(slideHash);
    }
    getDocWidth() {
        return this._metaPresentation.getDocWidth();
    }
    getDocHeight() {
        return this._metaPresentation.getDocHeight();
    }
    setDocWidth(slideWidth) {
        this._metaPresentation.setDocWidth(slideWidth);
    }
    setDocHeight(slideHeight) {
        this._metaPresentation.setDocHeight(slideHeight);
    }
    onUpdatePresentationInfo() {
        this.layerDrawing.onUpdatePresentationInfo();
        // TODO: optimize
        this.layerDrawing.invalidateAll();
    }
    getSlideHash(slideIndex) {
        return this._metaPresentation.getSlideHash(slideIndex);
    }
    createAnimatedElement(sId, slideHash, title, slideWidth, slideHeight, bIsTextElement) {
        return bIsTextElement
            ? new AnimatedTextElement(sId, slideHash, title, slideWidth, slideHeight)
            : new AnimatedElementBitmap(sId, slideHash, title, slideWidth, slideHeight);
    }
    getSlideSizePixel() {
        return [
            app.twipsToPixels * this._metaPresentation.getDocWidth(),
            app.twipsToPixels * this._metaPresentation.getDocHeight(),
        ];
    }
    computeLayerResolution(width, height) {
        width *= 1.2;
        height *= 1.2;
        let resolutionWidth = 960;
        let resolutionHeight = 540;
        if (width > 3840 || height > 2160) {
            resolutionWidth = 3840;
            resolutionHeight = 2160;
        }
        else if (width > 2560 || height > 1440) {
            resolutionWidth = 2560;
            resolutionHeight = 1440;
        }
        else if (width > 1920 || height > 1080) {
            resolutionWidth = 1920;
            resolutionHeight = 1080;
        }
        else if (width > 1280 || height > 720) {
            resolutionWidth = 1280;
            resolutionHeight = 720;
        }
        // On a phone or tablet the system kills the browser content process
        // when it passes its memory ceiling. A transition holds every layer
        // of two slides as both a bitmap and a GPU texture, and a layer is
        // 33 MB at 3840x2160 but 8 MB at 1920x1080.
        if (window.L.Browser.mobile) {
            resolutionWidth = Math.min(resolutionWidth, 1920);
            resolutionHeight = Math.min(resolutionHeight, 1080);
        }
        return [resolutionWidth, resolutionHeight];
    }
    // return [width, height]
    getCanvasSize() {
        return this.layerDrawing.getCanvasSize();
    }
    getSlide(slideNumber) {
        return this.layerDrawing.getSlide(slideNumber);
    }
    getLayerRendererContext() {
        return this.layerDrawing.getLayerRendererContext();
    }
    getVideoRenderer(slideHash, videoInfo) {
        return this.layerDrawing.getVideoRenderer(slideHash, videoInfo);
    }
    getAnimatedSlide(slideIndex) {
        return this.layerDrawing.getAnimatedSlide(slideIndex);
    }
    getAnimatedLayerInfo(slideHash, targetElement) {
        return this.layerDrawing.getAnimatedLayerInfo(slideHash, targetElement);
    }
    getLayerImage(slideHash, targetElement) {
        return this.layerDrawing.getLayerImage(slideHash, targetElement);
    }
    getLayerBounds(slideHash, targetElement) {
        return this.layerDrawing.getLayerBounds(slideHash, targetElement);
    }
    isSlideShowPlaying() {
        return this._slideShowPresenter._checkAlreadyPresenting();
    }
    deleteResources() {
        this.layerDrawing.deleteResources();
    }
    pauseVideos(slideHash) {
        this.layerDrawing.pauseVideos(slideHash);
    }
    notifyTransitionStart() {
        this.layerDrawing.notifyTransitionStart();
    }
    notifyTransitionEnd(slideHash) {
        this.layerDrawing.notifyTransitionEnd(slideHash);
    }
}
SlideShow.LayersCompositor = LayersCompositor;

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class SlideCompositor {
    constructor(slideShowPresenter) {
        this._slideShowPresenter = null;
        this._metaPresentation = null;
        this._initialSlideNumber = 0;
        this._onGotSlideCallback = null;
        this._slideShowPresenter = slideShowPresenter;
        this._addHooks();
    }
    // The presentation to draw. It is built after the compositor.
    setMetaPresentation(metaPresentation) {
        this._metaPresentation = metaPresentation;
    }
    getAnimatedElement(slideHash, animatedElementHash) {
        return this.getAnimatedElementMap(slideHash)?.get(animatedElementHash);
    }
    /// The animated elements of the slide by target, or undefined without
    /// animations.
    getAnimatedElementMap(slideHash) {
        const metaSlide = this._metaPresentation.getMetaSlide(slideHash);
        if (!metaSlide) {
            window.app.console.log('SlideCompositor.getAnimatedElementMap: failed to retrieve meta slide for hash: ' +
                slideHash);
            return undefined;
        }
        return metaSlide.animationsHandler?.getAnimatedElementMap();
    }
    computeLayerSize(width, height) {
        // compute the slide size in pixel with respect to the current resolution
        const slideWidth = this._metaPresentation.getDocWidth();
        const slideHeight = this._metaPresentation.getDocHeight();
        const slideRatio = slideWidth / slideHeight;
        const resolutionRatio = width / height;
        if (slideRatio > resolutionRatio) {
            height = Math.trunc((width * slideHeight) / slideWidth);
        }
        else if (slideRatio < resolutionRatio) {
            width = Math.ceil((height * slideWidth) / slideHeight);
        }
        return [width, height];
    }
    fetchAndRun(slideNumber, callback) {
        this._initialSlideNumber = slideNumber;
        this._onGotSlideCallback = callback;
    }
    /// Draw the current frame of the slide straight into a WebGL context, filling its canvas, or
    /// into texture when one is given. The context is the one of the slideshow canvas, or of a
    /// canvas that shows the frames in another window. False when the compositor does not draw
    /// the frame.
    drawFrameInto(_context, _slideIndex, _texture) {
        return false;
    }
    /// True when the compositor draws the frames of the slides straight into a WebGL context.
    drawsFrames() {
        return false;
    }
}
SlideShow.SlideCompositor = SlideCompositor;

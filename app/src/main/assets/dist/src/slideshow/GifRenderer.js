/* -*- js-indent-level: 8 -*- */
class GifRenderInfo extends AnimatedContentRenderInfo {
    constructor() {
        super(...arguments);
        this.source = null;
        this.renderLoopStarted = false;
    }
    setup(sId, slideRenderer, url) {
        this.sId = sId;
        this.slideRenderer = slideRenderer;
        this.decoderUrl = url;
    }
    load() {
        this.source = new GifFrameSource(this.decoderUrl, () => {
            if (this.renderLoopStarted)
                return;
            this.renderLoopStarted = true;
            this.slideRenderer.notifyGifStarted(this.sId);
        });
        this.source.load();
    }
    getCurrentFrame() {
        return this.source ? this.source.getCurrentFrame() : null;
    }
    deleteResources(context) {
        this.slideRenderer.notifyGifEnded(this.sId);
        if (this.source) {
            this.source.dispose();
            this.source = null;
        }
        super.deleteResources(context);
    }
}
class GifRenderer2d extends AnimatedContentRenderer2d {
    prepare(gifInfo, docWidth, docHeight) {
        const gif = new GifRenderInfo();
        gif.setup(this.sId, this._slideRenderer, gifInfo.url);
        gif.pos2d = this.getDocumentPositions(gifInfo.x, gifInfo.y, gifInfo.width, gifInfo.height, docWidth, docHeight);
        gif.mirror = gifInfo.mirror ?? 0;
        this.info = gif;
        this.infoId = gifInfo.id;
    }
    getDrawable() {
        return this.info.getCurrentFrame();
    }
}
class GifRendererGl extends AnimatedContentRendererGl {
    prepare(gifInfo, docWidth, docHeight) {
        const gif = new GifRenderInfo();
        gif.setup(this.sId, this._slideRenderer, gifInfo.url);
        gif.replaceTexture(this._context, this.initTexture());
        gif.replaceVao(this._context, this.setupRectangleInDocumentPositions(gifInfo.x, gifInfo.y, gifInfo.width, gifInfo.height, docWidth, docHeight, gifInfo.mirror ?? 0));
        this.info = gif;
        this.infoId = gifInfo.id;
    }
    getDrawable() {
        return this.info.getCurrentFrame();
    }
    placeholderPixel() {
        return new Uint8Array([0, 0, 0, 0]); // transparent
    }
}
function makeGifRenderer(sId, context, slideRenderer) {
    return context.is2dGl()
        ? new GifRenderer2d(sId, context, slideRenderer)
        : new GifRendererGl(sId, context, slideRenderer);
}

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class VideoRenderInfo extends AnimatedContentRenderInfo {
    setup(sId, slideRenderer, videoInfo) {
        this.sId = sId;
        this.slideRenderer = slideRenderer;
        const video = document.createElement('video');
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.loop = videoInfo.loop;
        video.muted = videoInfo.mute;
        video.addEventListener('playing', () => {
            this.playing = true;
            this.ended = false;
            this.slideRenderer.notifyVideoStarted(this.sId);
        }, true);
        video.addEventListener('pause', () => {
            this.playing = false;
            this.slideRenderer.notifyVideoEnded(this.sId);
        }, true);
        video.addEventListener('ended', () => {
            this.playing = false;
            this.ended = true;
            this.slideRenderer.notifyVideoEnded(this.sId);
        }, true);
        video.src = videoInfo.url;
        this.videoElement = video;
    }
    load() {
        this.videoElement.load();
    }
    play(reset = true) {
        if (reset)
            this.videoElement.currentTime = 0;
        this.videoElement.play();
    }
    pause() {
        app.console.debug('VideoRenderInfo.pause');
        this.videoElement.pause();
    }
    stop() {
        this.pause();
        this.videoElement.currentTime = 0;
    }
    playFrom(seconds) {
        this.videoElement.currentTime = seconds;
        this.videoElement.play();
    }
    handleClick() {
        if (this.playing) {
            this.pause();
        }
        else if (this.ended) {
            this.play(true);
        }
        else {
            this.play(false);
        }
    }
    // Dropping the source stops the download and frees the buffer.
    deleteResources(context) {
        this.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
        super.deleteResources(context);
    }
}
class VideoRenderer2d extends AnimatedContentRenderer2d {
    prepare(videoInfo, docWidth, docHeight) {
        const video = new VideoRenderInfo();
        video.setup(this.sId, this._slideRenderer, videoInfo);
        video.pos2d = this.getDocumentPositions(videoInfo.x, videoInfo.y, videoInfo.width, videoInfo.height, docWidth, docHeight);
        this.info = video;
        this.infoId = videoInfo.id;
    }
    getDrawable() {
        return this.info.videoElement;
    }
    // A video shows a frame once it holds the picture of its current time.
    currentFrame() {
        const video = this.info;
        if (!video)
            return null;
        const element = video.videoElement;
        if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
            return null;
        return { source: element, edges: video.pos2d, mirror: video.mirror };
    }
}
class VideoRendererGl extends AnimatedContentRendererGl {
    prepare(videoInfo, docWidth, docHeight) {
        const video = new VideoRenderInfo();
        video.setup(this.sId, this._slideRenderer, videoInfo);
        video.replaceTexture(this._context, this.initTexture());
        video.replaceVao(this._context, this.setupRectangleInDocumentPositions(videoInfo.x, videoInfo.y, videoInfo.width, videoInfo.height, docWidth, docHeight));
        this.info = video;
        this.infoId = videoInfo.id;
    }
    placeholderPixel() {
        return new Uint8Array([0, 0, 255, 255]); // opaque blue
    }
    getDrawable() {
        const video = this.info;
        // Keep returning the current decoded frame once playback has started,
        // including after the video ends, so the final frame stays on screen
        // instead of the slide's own still image showing through underneath.
        if (video.videoElement.currentTime <= 0)
            return null;
        return this.getOrientedFrame(video.videoElement);
    }
    getOrientedFrame(video) {
        if (!this.frameCanvas) {
            this.frameCanvas = document.createElement('canvas');
            this.frameContext = this.frameCanvas.getContext('2d');
        }
        if (this.frameCanvas.width !== video.videoWidth ||
            this.frameCanvas.height !== video.videoHeight) {
            this.frameCanvas.width = video.videoWidth;
            this.frameCanvas.height = video.videoHeight;
        }
        this.frameContext.drawImage(video, 0, 0);
        return this.frameCanvas;
    }
}
function makeVideoRenderer(sId, context, slideRenderer) {
    return context.is2dGl()
        ? new VideoRenderer2d(sId, context, slideRenderer)
        : new VideoRendererGl(sId, context, slideRenderer);
}

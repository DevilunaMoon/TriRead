// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class PauseTimer {
}
class PauseTimer2d {
    constructor(canvasContext, pauseDuration, onComplete) {
        this.onComplete = onComplete;
    }
    startTimer() {
        this.onComplete();
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    stopTimer() { }
}
class PauseTimerGl extends StaticTextRenderer {
    constructor(canvasContext, pauseDuration, onComplete) {
        super(canvasContext);
        this.pauseDuration = pauseDuration;
        this.pauseTimeRemaining = pauseDuration;
        this.onComplete = onComplete;
        if (this.context.isDisposed())
            return;
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = this.context.canvas.width;
        this.textCanvas.height = this.context.canvas.height;
        this.ctx = this.textCanvas.getContext('2d');
        this.textTexture = this.createTextTexture(this.getPauseTextContent());
        this.prepareTransition();
    }
    startTimer() {
        if (this.context.isDisposed())
            return;
        this.startTime = performance.now();
        requestAnimationFrame(this.animate.bind(this));
    }
    stopTimer() {
        this.pauseTimeRemaining = 0;
        this.delete2dTextCanvas();
    }
    animate() {
        if (this.context.isDisposed())
            return;
        if (!this.textCanvas || !this.ctx)
            return;
        const currentTime = performance.now();
        const elapsedTime = (currentTime - this.startTime) / 1000;
        this.pauseTimeRemaining = Math.max(0, this.pauseDuration - elapsedTime);
        this.textTexture = this.createTextTexture(this.getPauseTextContent());
        this.render();
        requestAnimationFrame(this.animate.bind(this));
        if (this.pauseTimeRemaining <= 0) {
            this.onComplete();
            this.delete2dTextCanvas();
            return;
        }
    }
    createTextTexture(displayText) {
        if (this.context.isDisposed())
            return null;
        this.clearCanvas();
        this.drawText(displayText);
        return this.load2dCanvasToGlCanvas(this.textCanvas);
    }
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.textCanvas.width, this.textCanvas.height);
    }
    // add text on off screen canvas...
    drawText(displayText) {
        if (this.context.isDisposed())
            return;
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(displayText, this.textCanvas.width / 2, this.textCanvas.height / 2);
    }
    delete2dTextCanvas() {
        if (this.textCanvas) {
            this.textCanvas.remove();
            this.textCanvas = null;
            this.ctx = null;
        }
    }
    getPauseTextContent() {
        return _('Pause... ( %SECONDS% )').replace('%SECONDS%', Math.ceil(this.pauseTimeRemaining).toString());
    }
}
SlideShow.PauseTimer = PauseTimer;
SlideShow.PauseTimer2d = PauseTimer2d;
SlideShow.PauseTimerGl = PauseTimerGl;

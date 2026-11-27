/* -*- js-indent-level: 8 -*- */
class ReflectionTransition extends SimpleTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    // TODO - remove code duplication
    /* jscpd:ignore-start */
    displaySlides_(t) {
        this.applyAllOperation(t);
        if (t < 0.5) {
            this.displayPrimitive(t, this.gl.TEXTURE0, 0, this.leavingPrimitives, 'slideTexture');
        }
        else {
            this.displayPrimitive(t, this.gl.TEXTURE0, 1, this.enteringPrimitives, 'slideTexture');
        }
    }
}
SlideShow.ReflectionTransition = ReflectionTransition;

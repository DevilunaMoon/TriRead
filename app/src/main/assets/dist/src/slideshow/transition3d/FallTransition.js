/* -*- js-indent-level: 8 -*- */
class FallTransition extends SimpleTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    displaySlides_(t) {
        this.applyAllOperation(t);
        this.displayPrimitive(t, this.gl.TEXTURE0, 1, this.enteringPrimitives, 'slideTexture');
        this.displayPrimitive(t, this.gl.TEXTURE0, 0, this.leavingPrimitives, 'slideTexture');
    }
}
function makeFallTransition(transitionParameters) {
    const slide = new Primitive();
    slide.pushTriangle([0, 0], [1, 0], [0, 1]);
    slide.pushTriangle([1, 0], [0, 1], [1, 1]);
    const aEnteringPrimitives = [];
    aEnteringPrimitives.push(Primitive.cloneDeep(slide));
    slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(1, 0, 0), vec3.fromValues(0, -1, 0), 90, true, true, 0.0, 1.0));
    const aLeavingPrimitives = [];
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    const aOperations = [];
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: aOperations,
    };
    return new FallTransition(newTransitionParameters);
}
SlideShow.makeFallTransition = makeFallTransition;

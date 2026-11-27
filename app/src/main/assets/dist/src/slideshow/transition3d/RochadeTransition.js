/* -*- js-indent-level: 8 -*- */
class RochadeTransitionImp extends SimpleTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    // TODO - remove code duplication
    /* jscpd:ignore-start */
    displaySlides_(t) {
        this.applyAllOperation(t);
        if (t < 0.5) {
            this.displayPrimitive(t, this.gl.TEXTURE0, 1, this.enteringPrimitives, 'slideTexture');
            this.displayPrimitive(t, this.gl.TEXTURE0, 0, this.leavingPrimitives, 'slideTexture');
        }
        else {
            this.displayPrimitive(t, this.gl.TEXTURE0, 0, this.leavingPrimitives, 'slideTexture');
            this.displayPrimitive(t, this.gl.TEXTURE0, 1, this.enteringPrimitives, 'slideTexture');
        }
    }
}
// TODO - remove code duplication
/* jscpd:ignore-start */
function RochadeTransition(transitionParameters) {
    const slide = new Primitive();
    const w = 2.2;
    const h = 10.0;
    slide.pushTriangle([0, 0], [1, 0], [0, 1]);
    slide.pushTriangle([1, 0], [0, 1], [1, 1]);
    slide.operations.push(makeSEllipseTranslate(w, h, 0.25, -0.25, true, 0, 1));
    slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0), -45, true, true, 0.0, 1.0));
    const aLeavingPrimitives = [];
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    slide.operations.push(makeSScale(vec3.fromValues(1.0, -1.0, 1.0), vec3.fromValues(0, -1.02, 0), false, -1, 0));
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    slide.clear();
    slide.operations.push(makeSEllipseTranslate(w, h, 0.75, 0.25, true, 0.0, 1.0));
    slide.operations.push(makeSTranslate(vec3.fromValues(0.0, 0.0, -h), false, -1.0, 0.0));
    slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0.0, 1.0, 0.0), vec3.fromValues(0.0, 0.0, 0.0), -45.0, true, true, 0.0, 1.0));
    slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0.0, 1.0, 0.0), vec3.fromValues(0.0, 0.0, 0.0), 45.0, true, false, -1.0, 0.0));
    const aEnteringPrimitives = [Primitive.cloneDeep(slide)];
    slide.operations.push(makeSScale(vec3.fromValues(1.0, -1.0, 1.0), vec3.fromValues(0, -1.02, 0), false, -1, 0));
    aEnteringPrimitives.push(Primitive.cloneDeep(slide));
    // Todo: Improve second view
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: [],
    };
    return new RochadeTransitionImp(newTransitionParameters);
}
/* jscpd:ignore-end */
SlideShow.RochadeTransition = RochadeTransition;

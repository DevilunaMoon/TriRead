/* -*- js-indent-level: 8 -*- */
// TODO - remove code duplication
/* jscpd:ignore-start */
function TurnDownTransition(transitionParameters) {
    const slide = new Primitive();
    slide.pushTriangle([0, 0], [1, 0], [0, 1]);
    slide.pushTriangle([1, 0], [0, 1], [1, 1]);
    const aLeavingPrimitives = [];
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    slide.operations.push(makeSTranslate(vec3.fromValues(0, 0, 0.0001), false, -1.0, 0.0));
    slide.operations.push(makeSRotate(vec3.fromValues(0, 0, 1), vec3.fromValues(-1, 1, 0), -90, true, 0.0, 1.0));
    slide.operations.push(makeSRotate(vec3.fromValues(0, 0, 1), vec3.fromValues(-1, 1, 0), 90, false, -1.0, 0.0));
    const aEnteringPrimitives = [];
    aEnteringPrimitives.push(slide);
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: [],
    };
    return new SimpleTransition(newTransitionParameters);
}
/* jscpd:ignore-end */
SlideShow.TurnDownTransition = TurnDownTransition;

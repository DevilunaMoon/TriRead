/* -*- js-indent-level: 8 -*- */
// TODO - remove code duplication
/* jscpd:ignore-start */
function TurnAroundTransition(transitionParameters) {
    const slide = new Primitive();
    slide.pushTriangle([0, 0], [1, 0], [0, 1]);
    slide.pushTriangle([1, 0], [0, 1], [1, 1]);
    const aLeavingPrimitives = [];
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    slide.operations.push(makeSScale(vec3.fromValues(1.0, -1.0, 1.0), vec3.fromValues(0, -1.02, 0), false, -1, 0));
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    slide.clear();
    slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0), -180, true, false, 0.0, 1.0));
    const aEnteringPrimitives = [Primitive.cloneDeep(slide)];
    slide.operations.push(makeSScale(vec3.fromValues(1.0, -1.0, 1.0), vec3.fromValues(0, -1.02, 0), false, -1, 0));
    aEnteringPrimitives.push(Primitive.cloneDeep(slide));
    const aOperations = [];
    aOperations.push(makeSTranslate(vec3.fromValues(0, 0, -1.5), true, 0, 0.5));
    aOperations.push(makeSTranslate(vec3.fromValues(0, 0, 1.5), true, 0.5, 1));
    aOperations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 0), -180, true, true, 0.0, 1.0));
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: aOperations,
    };
    return new ReflectionTransition(newTransitionParameters);
}
/* jscpd:ignore-end */
SlideShow.TurnAroundTransition = TurnAroundTransition;

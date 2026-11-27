/* -*- js-indent-level: 8 -*- */
function CubeTransition(transitionParameters, isOutside = true) {
    const slide = new Primitive();
    slide.pushTriangle([0, 0], [1, 0], [0, 1]);
    slide.pushTriangle([1, 0], [0, 1], [1, 1]);
    const aLeavingPrimitives = [];
    aLeavingPrimitives.push(Primitive.cloneDeep(slide));
    if (isOutside) {
        slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, -1), 90, false, false, 0.0, 1.0));
    }
    else {
        slide.operations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 1), -90, false, false, 0.0, 1.0));
    }
    const aEnteringPrimitives = [];
    aEnteringPrimitives.push(slide);
    const aOperations = [];
    aOperations.push(makeSScale(vec3.fromValues(0.9, 0.9, 0.9), vec3.fromValues(0, 0, 0), true, 0.0, 0.5));
    aOperations.push(makeSScale(vec3.fromValues(1.1, 1.1, 1.1), vec3.fromValues(0, 0, 0), true, 0.5, 1.0));
    if (isOutside) {
        aOperations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, -1), -90, false, true, 0.0, 1.0));
    }
    else {
        aOperations.push(makeRotateAndScaleDepthByWidth(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 1), 90, false, true, 0.0, 1.0));
    }
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: aOperations,
    };
    return new SimpleTransition(newTransitionParameters);
}
SlideShow.CubeTransition = CubeTransition;

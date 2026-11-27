/* -*- js-indent-level: 8 -*- */
function NewsFlashTransition(transitionParameters) {
    const lSlide = new Primitive();
    const eSlide = new Primitive();
    lSlide.pushTriangle([0, 0], [1, 0], [0, 1]);
    lSlide.pushTriangle([1, 0], [0, 1], [1, 1]);
    eSlide.pushTriangle([0, 0], [1, 0], [0, 1]);
    eSlide.pushTriangle([1, 0], [0, 1], [1, 1]);
    lSlide.operations.push(makeSRotate(vec3.fromValues(0, 0, 1), vec3.fromValues(0, 0, 0), 3000, true, 0, 0.5));
    lSlide.operations.push(makeSScale(vec3.fromValues(0.01, 0.01, 0.01), vec3.fromValues(0, 0, 0), true, 0, 0.5));
    lSlide.operations.push(makeSTranslate(vec3.fromValues(-10000, 0, 0), false, 0.5, 2));
    const aLeavingPrimitives = [lSlide];
    eSlide.operations.push(makeSRotate(vec3.fromValues(0, 0, 1), vec3.fromValues(0, 0, 0), -3000, true, 0.5, 1));
    eSlide.operations.push(makeSTranslate(vec3.fromValues(-100, 0, 0), false, -1, 1));
    eSlide.operations.push(makeSTranslate(vec3.fromValues(100, 0, 0), false, 0.5, 1));
    eSlide.operations.push(makeSScale(vec3.fromValues(0.01, 0.01, 0.01), vec3.fromValues(0, 0, 0), false, -1, 1));
    eSlide.operations.push(makeSScale(vec3.fromValues(100, 100, 100), vec3.fromValues(0, 0, 0), true, 0.5, 1));
    const aEnteringPrimitives = [eSlide];
    const aOperations = [];
    aOperations.push(makeSRotate(vec3.fromValues(0, 0, 1), vec3.fromValues(0.2, 0.2, 0), 1080, true, 0, 1));
    const newTransitionParameters = {
        ...transitionParameters,
        leavingPrimitives: aLeavingPrimitives,
        enteringPrimitives: aEnteringPrimitives,
        allOperations: aOperations,
    };
    return new SimpleTransition(newTransitionParameters);
}
SlideShow.NewsFlashTransition = NewsFlashTransition;

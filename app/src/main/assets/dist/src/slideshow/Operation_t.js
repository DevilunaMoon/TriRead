/* -*- js-indent-level: 8 -*- */
class Operation_t {
    constructor(OperationCB) {
        this.OperationCB = OperationCB;
    }
    applyOperations(matrix, t, SlideWidthScale, SlideHeightScale) {
        return this.OperationCB().interpolate(matrix, t, SlideWidthScale, SlideHeightScale);
    }
}
SlideShow.Operation_t = Operation_t;

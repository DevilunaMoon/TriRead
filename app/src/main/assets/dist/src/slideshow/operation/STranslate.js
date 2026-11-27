/* -*- js-indent-level: 8 -*- */
var { vec3, mat4 } = glMatrix;
class STranslate extends Operation {
    // TODO - remove code duplication
    /* jscpd:ignore-start */
    constructor(vector, mbInterpolate, mnT0, mnT1) {
        super();
        this.mbInterpolate = false;
        this.mnT0 = 0.0;
        this.mnT1 = 0.0;
        this.vector = vector;
        this.mbInterpolate = mbInterpolate;
        this.mnT0 = mnT0;
        this.mnT1 = mnT1;
    }
    interpolate(matrix, t, SlideWidthScale, SlideHeightScale) {
        if (t <= this.mnT0)
            return matrix;
        if (!this.mbInterpolate || t > this.mnT1)
            t = this.mnT1;
        t = OpsHelper.intervalInter(t, this.mnT0, this.mnT1);
        mat4.translate(matrix, matrix, vec3.fromValues(SlideWidthScale * t * this.vector[0], SlideHeightScale * t * this.vector[1], t * this.vector[2]));
        return matrix;
    }
}
function makeSTranslate(vector, mbInterpolate, mnT0, mnT1) {
    return new STranslate(vector, mbInterpolate, mnT0, mnT1);
}
SlideShow.makeSTranslate = makeSTranslate;

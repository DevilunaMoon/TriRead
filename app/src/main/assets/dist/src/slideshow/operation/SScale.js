/* -*- js-indent-level: 8 -*- */
var { vec3, mat4 } = glMatrix;
class SScale extends Operation {
    constructor(scale, origin, mbInterpolate, mnT0, mnT1) {
        super();
        this.scale = vec3.create();
        this.origin = vec3.create();
        this.mbInterpolate = false;
        this.mnT0 = 0.0;
        this.mnT1 = 0.0;
        this.scale = scale;
        this.origin = origin;
        this.mbInterpolate = mbInterpolate;
        this.mnT0 = mnT0;
        this.mnT1 = mnT1;
    }
    scaleMatrix(matrix, t, scale) {
        const scaleFactor = vec3.create();
        vec3.scale(scaleFactor, scale, t); // (t * scale)
        vec3.add(scaleFactor, scaleFactor, [1 - t, 1 - t, 1 - t]); // (1 - t) + (t * scale)
        const scaledMatrix = mat4.clone(matrix);
        mat4.scale(scaledMatrix, scaledMatrix, scaleFactor);
        return scaledMatrix;
    }
    interpolate(matrix, t, SlideWidthScale, SlideHeightScale) {
        if (t <= this.mnT0)
            return matrix;
        if (!this.mbInterpolate || t > this.mnT1)
            t = this.mnT1;
        t = OpsHelper.intervalInter(t, this.mnT0, this.mnT1);
        const translationVector = vec3.fromValues(SlideWidthScale * this.origin[0], SlideHeightScale * this.origin[1], this.origin[2]);
        mat4.translate(matrix, matrix, translationVector);
        matrix = this.scaleMatrix(matrix, t, this.scale);
        mat4.translate(matrix, matrix, vec3.negate(vec3.create(), translationVector));
        return matrix;
    }
}
function makeSScale(scale, origin, mbInterpolate, mnT0, mnT1) {
    return new SScale(scale, origin, mbInterpolate, mnT0, mnT1);
}
SlideShow.makeSScale = makeSScale;

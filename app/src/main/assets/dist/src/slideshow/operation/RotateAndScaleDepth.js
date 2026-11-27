/* -*- js-indent-level: 8 -*- */
var { vec3, mat4 } = glMatrix;
class RotateAndScaleDepth extends Operation {
    constructor(axis, origin, angle, scale, mbInterpolate, mnT0, mnT1, isDepthByWidth) {
        super();
        this.axis = vec3.create();
        this.origin = vec3.create();
        this.angle = 0.0;
        this.scale = false;
        this.mbInterpolate = false;
        this.mnT0 = 0.0;
        this.mnT1 = 0.0;
        this.isDepthByWidth = true;
        this.axis = axis;
        this.origin = origin;
        this.angle = OpsHelper.deg2rad(angle);
        this.scale = scale;
        this.mbInterpolate = mbInterpolate;
        this.mnT0 = mnT0;
        this.mnT1 = mnT1;
        this.isDepthByWidth = isDepthByWidth;
    }
    interpolate(matrix, t, SlideWidthScale, SlideHeightScale) {
        if (t <= this.mnT0) {
            return matrix;
        }
        if (!this.mbInterpolate || t > this.mnT1) {
            t = this.mnT1;
        }
        t = OpsHelper.intervalInter(t, this.mnT0, this.mnT1);
        const translationVector = vec3.fromValues(SlideWidthScale * this.origin[0], SlideHeightScale * this.origin[1], (this.isDepthByWidth ? SlideWidthScale : SlideHeightScale) *
            this.origin[2]);
        const scaleVector = vec3.fromValues(SlideWidthScale * SlideWidthScale, SlideHeightScale * SlideHeightScale, 1);
        mat4.translate(matrix, matrix, translationVector);
        if (this.scale) {
            mat4.scale(matrix, matrix, scaleVector);
        }
        mat4.rotate(matrix, matrix, this.angle * t, this.axis);
        if (this.scale) {
            mat4.scale(matrix, matrix, vec3.fromValues(1 / scaleVector[0], 1 / scaleVector[1], 1 / scaleVector[2]));
        }
        mat4.translate(matrix, matrix, vec3.negate(vec3.create(), translationVector));
        return matrix;
    }
}
function makeRotateAndScaleDepthByWidth(axis, origin, angle, scale, mbInterpolate, mnT0, mnT1) {
    return new RotateAndScaleDepth(axis, origin, angle, scale, mbInterpolate, mnT0, mnT1, true);
}
function makeRotateAndScaleDepthByHeight(axis, origin, angle, scale, mbInterpolate, mnT0, mnT1) {
    return new RotateAndScaleDepth(axis, origin, angle, scale, mbInterpolate, mnT0, mnT1, false);
}
SlideShow.makeRotateAndScaleDepthByWidth = makeRotateAndScaleDepthByWidth;
SlideShow.makeRotateAndScaleDepthByHeight = makeRotateAndScaleDepthByHeight;

/* -*- js-indent-level: 8 -*- */
var { vec2, vec3, mat4 } = glMatrix;
class Operation {
    interpolate(matrix, t, SlideWidthScale, SlideHeightScale) {
        return matrix;
    }
}
SlideShow.Operation = Operation;
class OpsHelper {
    static intervalInter(t, T0, T1) {
        return (t - T0) / (T1 - T0);
    }
    static deg2rad(v, degMultiple = 1) {
        // Divide first for exact values at multiples of 90 degrees
        return ((v / (90.0 * degMultiple)) * Math.PI) / 2;
    }
}
SlideShow.OpsHelper = OpsHelper;

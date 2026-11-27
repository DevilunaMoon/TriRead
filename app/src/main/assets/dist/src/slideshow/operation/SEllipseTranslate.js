/* -*- js-indent-level: 8 -*- */
var { vec3, mat4 } = glMatrix;
class SEllipseTranslate extends Operation {
    constructor(dWidth, dHeight, dStartPosition, dEndPosition, bInter, T0, T1) {
        super();
        this.width = 0.0;
        this.height = 0.0;
        this.startPosition = 0.0;
        this.endPosition = 0.0;
        this.mbInterpolate = false;
        this.mnT0 = 0.0;
        this.mnT1 = 0.0;
        this.width = dWidth;
        this.height = dHeight;
        this.startPosition = dStartPosition;
        this.endPosition = dEndPosition;
        this.mbInterpolate = bInter;
        this.mnT0 = T0;
        this.mnT1 = T1;
    }
    interpolate(matrix, t, SlideWidthScale, SlideHeightScale) {
        if (t <= this.mnT0)
            return matrix;
        if (!this.mbInterpolate || t > this.mnT1)
            t = this.mnT1;
        t = OpsHelper.intervalInter(t, this.mnT0, this.mnT1);
        // let a1:number ,a2: number ,x :number, y: number ;
        const a1 = this.startPosition * 2 * Math.PI;
        const a2 = (this.startPosition + t * (this.endPosition - this.startPosition)) *
            2 *
            Math.PI;
        const x = (this.width * (Math.cos(a2) - Math.cos(a1))) / 2;
        const y = (this.height * (Math.sin(a2) - Math.sin(a1))) / 2;
        mat4.translate(matrix, matrix, vec3.fromValues(x, 0, y));
        return matrix;
    }
}
function makeSEllipseTranslate(dWidth, dHeight, dStartPosition, dEndPosition, bInter, T0, T1) {
    return new SEllipseTranslate(dWidth, dHeight, dStartPosition, dEndPosition, bInter, T0, T1);
}
SlideShow.makeSEllipseTranslate = makeSEllipseTranslate;

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var VenetianSubType;
(function (VenetianSubType) {
    VenetianSubType[VenetianSubType["HORIZONTAL"] = 0] = "HORIZONTAL";
    VenetianSubType[VenetianSubType["VERTICAL"] = 1] = "VERTICAL";
})(VenetianSubType || (VenetianSubType = {}));
class VenetianTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.HORIZONTAL) {
            this.direction = VenetianSubType.HORIZONTAL;
        }
        else {
            this.direction = VenetianSubType.VERTICAL;
        }
    }
    getMaskFunction() {
        const numBlinds = 6.0;
        const blindWidth = this.gl.canvas.width / numBlinds;
        const blindHeight = this.gl.canvas.height / numBlinds;
        const blindSize = this.direction == VenetianSubType.VERTICAL ? blindWidth : blindHeight;
        const comp = this.direction == VenetianSubType.VERTICAL ? 'x' : 'y';
        return `
                #define CANVAS_WIDTH ${this.gl.canvas.width}
                #define CANVAS_HEIGHT ${this.gl.canvas.height}

                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 resolution = vec2(CANVAS_WIDTH, CANVAS_HEIGHT);
                    float blindSize = float(${blindSize});

                    float position = mod(uv.${comp} * resolution.${comp}, blindSize);

                    float mask = step(position / blindSize, progress);

                    return mask;
                }
		`;
    }
}
SlideShow.VenetianTransition = VenetianTransition;

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var BarsSubType;
(function (BarsSubType) {
    BarsSubType[BarsSubType["VERTICAL"] = 0] = "VERTICAL";
    BarsSubType[BarsSubType["HORIZONTAL"] = 1] = "HORIZONTAL";
})(BarsSubType || (BarsSubType = {}));
class BarsTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.VERTICAL) {
            this.direction = BarsSubType.VERTICAL;
        }
        else if (transitionSubType == TransitionSubType.HORIZONTAL) {
            this.direction = BarsSubType.HORIZONTAL;
        }
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const isVerticalDir = this.direction == BarsSubType.VERTICAL;
        return `
                float random(vec2 co) {
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }

                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    float numBars = 128.0;
                    float coord = ${isVerticalDir ? 'uv.x' : 'uv.y'};
                    float randValue = random(vec2(floor(coord * numBars), 0.0));

                    bool showEntering = (randValue < progress);
                    return float(showEntering);
                }
		`;
    }
}
SlideShow.BarsTransition = BarsTransition;

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var OvalSubType;
(function (OvalSubType) {
    OvalSubType[OvalSubType["HORIZONTAL"] = 0] = "HORIZONTAL";
    OvalSubType[OvalSubType["VERTICAL"] = 1] = "VERTICAL";
})(OvalSubType || (OvalSubType = {}));
class OvalTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.HORIZONTAL) {
            this.direction = OvalSubType.HORIZONTAL;
        }
        else if (transitionSubType == TransitionSubType.VERTICAL) {
            this.direction = OvalSubType.VERTICAL;
        }
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const isHorizontalDir = this.direction == OvalSubType.HORIZONTAL;
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    ${isHorizontalDir ? 'dist.y' : 'dist.x'} *= 2.0;

                    float size = progress * 1.2;

                    float mask = step(length(dist), size);

                    mask = min(mask, 1.0);

                    return mask;
                }
		`;
    }
}
SlideShow.OvalTransition = OvalTransition;

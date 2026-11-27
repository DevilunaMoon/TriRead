// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var DiagonalSubType;
(function (DiagonalSubType) {
    DiagonalSubType[DiagonalSubType["BOTTOMLEFT"] = 0] = "BOTTOMLEFT";
    DiagonalSubType[DiagonalSubType["TOPLEFT"] = 1] = "TOPLEFT";
    DiagonalSubType[DiagonalSubType["TOPRIGHT"] = 2] = "TOPRIGHT";
    DiagonalSubType[DiagonalSubType["BOTTOMRIGHT"] = 3] = "BOTTOMRIGHT";
})(DiagonalSubType || (DiagonalSubType = {}));
class DiagonalTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.HORIZONTALRIGHT &&
            !this.transitionFilterInfo.isDirectionForward) {
            this.direction = DiagonalSubType.BOTTOMLEFT;
        }
        else if (transitionSubType == TransitionSubType.HORIZONTALLEFT &&
            !this.transitionFilterInfo.isDirectionForward) {
            this.direction = DiagonalSubType.BOTTOMRIGHT;
        }
        else if (transitionSubType == TransitionSubType.HORIZONTALRIGHT) {
            this.direction = DiagonalSubType.TOPRIGHT;
        }
        else {
            this.direction = DiagonalSubType.TOPLEFT;
        }
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const startsFromRight = this.direction == DiagonalSubType.TOPRIGHT ||
            this.direction == DiagonalSubType.BOTTOMRIGHT;
        const startsFromBottom = this.direction == DiagonalSubType.BOTTOMLEFT ||
            this.direction == DiagonalSubType.BOTTOMRIGHT;
        return `
                float getMaskValue(vec2 uv, float time) {
                    float u_steps = 10.0f;

                    float xCoord = ${startsFromRight ? '1.0f - uv.x' : 'uv.x'};
                    float yCoord = floor(uv.y * u_steps) / u_steps;
                    float yStep = ${startsFromBottom ? '1.0f - yCoord' : 'yCoord'};

                    float stepDelay = 1.0f;
                    float adjustedTime = time * 2.0f - yStep * stepDelay;

                    float stepWidth = 1.0f;
                    float mask = step(xCoord * stepWidth, adjustedTime);

                    return mask;
                }
		`;
    }
}
SlideShow.DiagonalTransition = DiagonalTransition;

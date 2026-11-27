// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var CheckersSubType;
(function (CheckersSubType) {
    CheckersSubType[CheckersSubType["ACROSS"] = 0] = "ACROSS";
    CheckersSubType[CheckersSubType["DOWN"] = 1] = "DOWN";
})(CheckersSubType || (CheckersSubType = {}));
class CheckersTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.DOWN) {
            this.direction = CheckersSubType.DOWN;
        }
        else if (transitionSubType == TransitionSubType.ACROSS) {
            this.direction = CheckersSubType.ACROSS;
        }
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const numSquares = 8;
        const edgeSize = 1.0 / numSquares;
        const isAcrossDir = this.direction == CheckersSubType.ACROSS;
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time * 2.0;

                    vec2 squareSize = vec2(${edgeSize}, ${edgeSize});
                    vec2 checkerCoord = floor(uv / squareSize);

                    bool isWhiteSquare = mod(checkerCoord.x + checkerCoord.y, 2.0) == 0.0;
                    vec2 localUV = fract(uv / squareSize);

                    float adjustedProgress = isWhiteSquare ? progress : progress - 1.0;
                    adjustedProgress = clamp(adjustedProgress, 0.0, 1.0);

                    float localCoord = ${isAcrossDir ? 'localUV.x' : 'localUV.y'};
                    bool showEntering = localCoord < adjustedProgress;

                    return float(showEntering);
                }
		`;
    }
}
SlideShow.CheckersTransition = CheckersTransition;

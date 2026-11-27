// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var WipeSubType;
(function (WipeSubType) {
    WipeSubType[WipeSubType["LEFTTORIGHT"] = 0] = "LEFTTORIGHT";
    WipeSubType[WipeSubType["RIGHTTOLEFT"] = 1] = "RIGHTTOLEFT";
    WipeSubType[WipeSubType["TOPTOBOTTOM"] = 2] = "TOPTOBOTTOM";
    WipeSubType[WipeSubType["BOTTOMTOTOP"] = 3] = "BOTTOMTOTOP";
})(WipeSubType || (WipeSubType = {}));
class WipeTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.TOPTOBOTTOM &&
            this.transitionFilterInfo.isDirectionForward) {
            this.direction = WipeSubType.TOPTOBOTTOM;
        }
        else if (transitionSubType == TransitionSubType.TOPTOBOTTOM &&
            !this.transitionFilterInfo.isDirectionForward) {
            this.direction = WipeSubType.BOTTOMTOTOP;
        }
        else if (transitionSubType == TransitionSubType.LEFTTORIGHT &&
            this.transitionFilterInfo.isDirectionForward) {
            this.direction = WipeSubType.LEFTTORIGHT;
        }
        else {
            this.direction = WipeSubType.RIGHTTOLEFT;
        }
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const isHorizontalDir = this.direction == WipeSubType.LEFTTORIGHT ||
            this.direction == WipeSubType.RIGHTTOLEFT;
        const isBackwardDir = this.direction == WipeSubType.RIGHTTOLEFT ||
            this.direction == WipeSubType.BOTTOMTOTOP;
        return `
        float getMaskValue(vec2 uv, float time) {
            float progress = time;

            float coord = ${isHorizontalDir ? 'uv.x' : 'uv.y'};
            ${isBackwardDir ? 'coord = 1.0 - coord;' : ''}
            float mask = step(coord, progress);
            return mask;
        }
		`;
    }
}
SlideShow.WipeTransition = WipeTransition;

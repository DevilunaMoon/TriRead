// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
var WheelSubType;
(function (WheelSubType) {
    WheelSubType[WheelSubType["ONEWHEEL"] = 1] = "ONEWHEEL";
    WheelSubType[WheelSubType["TWOWHEEL"] = 2] = "TWOWHEEL";
    WheelSubType[WheelSubType["THREEWHEEL"] = 3] = "THREEWHEEL";
    WheelSubType[WheelSubType["FOURWHEEL"] = 4] = "FOURWHEEL";
    WheelSubType[WheelSubType["EIGHTWHEEL"] = 8] = "EIGHTWHEEL";
})(WheelSubType || (WheelSubType = {}));
class WheelTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    initMaskFunctionParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.TWOBLADEVERTICAL) {
            this.stocks = WheelSubType.TWOWHEEL;
        }
        else if (transitionSubType == TransitionSubType.THREEBLADE) {
            this.stocks = WheelSubType.THREEWHEEL;
        }
        else if (transitionSubType == TransitionSubType.FOURBLADE) {
            this.stocks = WheelSubType.FOURWHEEL;
        }
        else if (transitionSubType == TransitionSubType.EIGHTBLADE) {
            this.stocks = WheelSubType.EIGHTWHEEL;
        }
        else {
            this.stocks = WheelSubType.ONEWHEEL;
        }
    }
    getMaskFunction() {
        const slice = (2.0 * Math.PI) / this.stocks;
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    float angle = atan(uv.y - 0.5, uv.x - 0.5) + ${Math.PI / 2};
                    float mask = step(mod(angle, ${slice}), ${slice} * progress);

                    return mask;
                }
		`;
    }
}
SlideShow.WheelTransition = WheelTransition;

/* -*- js-indent-level: 8 -*- */
class SplitTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    // jscpd:ignore-start
    getMaskFunction() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        const isHorizontalDir = transitionSubType == TransitionSubType.HORIZONTAL;
        // Horizontal Out, Vertical Out
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = progress * 1.5;

                    float distCoord = ${isHorizontalDir ? 'dist.y' : 'dist.x'};

                    float mask = step(size / 2.0, distCoord);

                    mask = 1.0 - mask;

                    return mask;
                }
		`;
    }
}
SlideShow.SplitTransition = SplitTransition;

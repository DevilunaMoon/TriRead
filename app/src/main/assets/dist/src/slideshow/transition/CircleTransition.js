/* -*- js-indent-level: 8 -*- */
class CircleTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    getMaskFunction() {
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    float dist = distance(uv, center);

                    float size = progress * 1.5;

                    float mask = step(dist, size);

                    mask = min(mask, 1.0);

                    return mask;
                }
		`;
    }
}
SlideShow.CircleTransition = CircleTransition;

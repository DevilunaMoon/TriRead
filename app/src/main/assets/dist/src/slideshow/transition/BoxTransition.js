/* -*- js-indent-level: 8 -*- */
class BoxTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    // jscpd:ignore-start
    getMaskFunction() {
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = progress * 1.5;

                    float mask = step(dist.x, size / 2.0) * step(dist.y, size / 2.0);

                    return mask;
                }
		`;
    }
}
SlideShow.BoxTransition = BoxTransition;

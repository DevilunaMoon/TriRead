/* -*- js-indent-level: 8 -*- */
class DiamondTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    getMaskFunction() {
        return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = progress * 1.5;

                    float mask = step(dist.x + dist.y, size);

                    return mask;
                }
		`;
    }
}
SlideShow.DiamondTransition = DiamondTransition;

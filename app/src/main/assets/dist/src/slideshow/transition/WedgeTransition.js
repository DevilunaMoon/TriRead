/* -*- js-indent-level: 8 -*- */
class WedgeTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    getMaskFunction() {
        return `
		            #define M_PI ${Math.PI}

                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = uv - center;
                    float angle = atan(dist.x, dist.y);

                    if (angle < 0.0) {
                        angle += 2.0 * M_PI;
                    }

                    float wedgeAngle = M_PI * progress;

                    float mask = step(angle, wedgeAngle) + step(2.0 * M_PI - wedgeAngle, angle);
										mask = min(mask, 1.0);

                    return mask;
                }
		`;
    }
}
SlideShow.WedgeTransition = WedgeTransition;

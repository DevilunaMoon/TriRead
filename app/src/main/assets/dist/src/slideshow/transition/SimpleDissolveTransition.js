/* -*- js-indent-level: 8 -*- */
class SimpleDissolveTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    getMaskFunction() {
        const numSquares = 16;
        const edgeSize = 1.0 / numSquares;
        return `
				// generate a pseudo-random value based on coordinates
				float random(vec2 co) {
					return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
				}

				float getMaskValue(vec2 uv, float time) {
					float progress = time;

					vec2 squareSize = vec2(${edgeSize}, ${edgeSize});

					vec2 checkerCoord = floor(uv / squareSize);

					float randValue = random(checkerCoord);

					bool showEntering = progress > randValue;

					return float(showEntering);
				}
		`;
    }
}
SlideShow.SimpleDissolveTransition = SimpleDissolveTransition;

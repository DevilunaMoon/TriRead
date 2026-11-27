/* -*- js-indent-level: 8 -*- */
var UncoverSubType;
(function (UncoverSubType) {
    UncoverSubType[UncoverSubType["FROMTOP"] = 0] = "FROMTOP";
    UncoverSubType[UncoverSubType["FROMRIGHT"] = 1] = "FROMRIGHT";
    UncoverSubType[UncoverSubType["FROMLEFT"] = 2] = "FROMLEFT";
    UncoverSubType[UncoverSubType["FROMBOTTOM"] = 3] = "FROMBOTTOM";
})(UncoverSubType || (UncoverSubType = {}));
class UncoverTransition extends Transition2d {
    constructor(transitionParameters) {
        super(transitionParameters);
        this.direction = 0;
    }
    start() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.FROMTOP) {
            this.direction = UncoverSubType.FROMTOP;
        }
        else if (transitionSubType == TransitionSubType.FROMLEFT) {
            this.direction = UncoverSubType.FROMLEFT;
        }
        else if (transitionSubType == TransitionSubType.FROMRIGHT) {
            this.direction = UncoverSubType.FROMRIGHT;
        }
        else {
            this.direction = UncoverSubType.FROMBOTTOM;
        }
        this.startTransition();
    }
    renderUniformValue() {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'direction'), this.direction);
    }
    // jscpd:ignore-start
    getFragmentShader() {
        return `#version 300 es
				precision mediump float;

				uniform sampler2D leavingSlideTexture;
				uniform sampler2D enteringSlideTexture;
				uniform float time;
				uniform int direction;

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec2 uv = v_texCoord;
					float progress = time;

					vec2 leavingUV = uv;
					vec2 enteringUV = uv;

					if (direction == 0) {
						leavingUV = uv + vec2(0.0, -progress);
					} else if (direction == 1) {
						leavingUV = uv + vec2(progress, 0.0);
					} else if (direction == 2) {
						leavingUV = uv + vec2(-progress, 0.0);
					} else if (direction == 3) {
						leavingUV = uv + vec2(0.0, progress);
					}
					else if (direction == 4) {
						// TODO: Meed to fix this bug, top right to bottom left
						leavingUV = uv + vec2(progress, -progress);
					}

					bool showEntering = false;
					if (direction == 0) {
						showEntering = uv.y < progress;
					} else if (direction == 1) {
						showEntering = uv.x > 1.0 - progress;
					} else if (direction == 2) {
						showEntering = uv.x < progress;
					} else if (direction == 3) {
						showEntering = uv.y > 1.0 - progress;
					} else if (direction == 4) {
						showEntering = uv.x > 1.0 - progress && uv.y < progress;
					}

					if (showEntering) {
						outColor = texture(enteringSlideTexture, enteringUV);
					} else {
						outColor = texture(leavingSlideTexture, leavingUV);
					}
				}
				`;
    }
}
SlideShow.UncoverTransition = UncoverTransition;

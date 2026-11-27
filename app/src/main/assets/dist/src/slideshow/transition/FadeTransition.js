/* -*- js-indent-level: 8 -*- */
var FadeSubType;
(function (FadeSubType) {
    FadeSubType[FadeSubType["FADEOVERBLACK"] = 0] = "FADEOVERBLACK";
    FadeSubType[FadeSubType["FADEOVERWHITE"] = 1] = "FADEOVERWHITE";
    FadeSubType[FadeSubType["SMOOTHLY"] = 2] = "SMOOTHLY";
})(FadeSubType || (FadeSubType = {}));
class FadeTransition extends SlideShow.Transition2d {
    constructor(transitionParameters) {
        super(transitionParameters);
        this.effectTransition = 0;
    }
    start() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        this.effectTransition = FadeSubType.FADEOVERBLACK; // default
        // A morph plays as a smooth fade from the old slide to the new one.
        if (transitionSubType == TransitionSubType.CROSSFADE ||
            transitionSubType == TransitionSubType.MORPH ||
            transitionSubType == TransitionSubType.MORPHBYWORD ||
            transitionSubType == TransitionSubType.MORPHBYCHARACTER) {
            this.effectTransition = FadeSubType.SMOOTHLY;
        }
        else if (transitionSubType == TransitionSubType.FADEOVERCOLOR &&
            this.transitionFilterInfo.fadeColor &&
            this.transitionFilterInfo.fadeColor.toUpperCase() === '#FFFFFF') {
            this.effectTransition = FadeSubType.FADEOVERWHITE;
        }
        this.startTransition();
    }
    renderUniformValue() {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'effectType'), this.effectTransition);
    }
    getFragmentShader() {
        return `#version 300 es
				precision mediump float;

				uniform sampler2D leavingSlideTexture;
				uniform sampler2D enteringSlideTexture;
				uniform float time;
				uniform int effectType; // 0: Fade through black, 1: Fade through white, 2: Smooth fade

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec4 color0 = texture(leavingSlideTexture, v_texCoord);
					vec4 color1 = texture(enteringSlideTexture, v_texCoord);
					vec4 transitionColor;

					if (effectType == 0) {
						// Fade through black
						transitionColor = vec4(0.0, 0.0, 0.0, 1.0);
					} else if (effectType == 1) {
						// Fade through white
						transitionColor = vec4(1.0, 1.0, 1.0, 1.0);
					}
					if (effectType == 2) {
						// Smooth fade
						float smoothTime = smoothstep(0.0, 1.0, time);
						outColor = mix(color0, color1, smoothTime);
					} else {
						if (time < 0.5) {
							outColor = mix(color0, transitionColor, time * 2.0);
						} else {
							outColor = mix(transitionColor, color1, (time - 0.5) * 2.0);
						}
					}
				}
				`;
    }
}
SlideShow.FadeTransition = FadeTransition;

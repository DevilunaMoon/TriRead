/* -*- js-indent-level: 8 -*- */
var CoverSubType;
(function (CoverSubType) {
    CoverSubType[CoverSubType["FROMBOTTOM"] = 0] = "FROMBOTTOM";
    CoverSubType[CoverSubType["FROMLEFT"] = 1] = "FROMLEFT";
    CoverSubType[CoverSubType["FROMRIGHT"] = 2] = "FROMRIGHT";
    CoverSubType[CoverSubType["FROMTOP"] = 3] = "FROMTOP";
})(CoverSubType || (CoverSubType = {}));
class CoverTransition extends Transition2d {
    constructor(transitionParameters) {
        super(transitionParameters);
        this.direction = 0;
    }
    start() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.FROMTOP) {
            this.direction = CoverSubType.FROMTOP;
        }
        else if (transitionSubType == TransitionSubType.FROMLEFT) {
            this.direction = CoverSubType.FROMLEFT;
        }
        else if (transitionSubType == TransitionSubType.FROMRIGHT) {
            this.direction = CoverSubType.FROMRIGHT;
        }
        else {
            this.direction = CoverSubType.FROMBOTTOM;
        }
        this.startTransition();
    }
    // jscpd:ignore-start
    renderUniformValue() {
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'direction'), this.direction);
    }
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
                        enteringUV = uv + vec2(0.0, -1.0 + progress);
                    } else if (direction == 1) {
                        enteringUV = uv + vec2(1.0 - progress, 0.0);
                    } else if (direction == 2) {
                        enteringUV = uv + vec2(-1.0 + progress, 0.0);
                    } else if (direction == 3) {
                        enteringUV = uv + vec2(0.0, 1.0 - progress);
                    } else if (direction == 4) {
                        // bottom left to top right
                        enteringUV = uv + vec2(1.0 - progress, -1.0 + progress);
                    } else if (direction == 5) {
                        // top right to bottom left
                        enteringUV = uv + vec2(-1.0 + progress, 1.0 - progress);
                    } else if (direction == 6) {
                        // top left to bottom right
                        enteringUV = uv + vec2(1.0 - progress, 1.0 - progress);
                    } else if (direction == 7) {
                        // bottom right to top left
                        enteringUV = uv + vec2(-1.0 + progress, -1.0 + progress);
                    }

                    bool showEntering = false;
                    if (direction == 0) {
                        showEntering = uv.y > 1.0 - progress;
                    } else if (direction == 1) {
                        showEntering = uv.x < progress;
                    } else if (direction == 2) {
                        showEntering = uv.x > 1.0 - progress;
                    } else if (direction == 3) {
                        showEntering = uv.y < progress;
                    } else if (direction == 4) {
                        showEntering = uv.x < progress && uv.y > 1.0 - progress;
                    } else if (direction == 5) {
                        showEntering = uv.x > 1.0 - progress && uv.y < progress;
                    } else if (direction == 6) {
                        showEntering = uv.x < progress && uv.y < progress;
                    } else if (direction == 7) {
                        showEntering = uv.x > 1.0 - progress && uv.y > 1.0 - progress;
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
SlideShow.CoverTransition = CoverTransition;

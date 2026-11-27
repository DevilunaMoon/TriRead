/* -*- js-indent-level: 8 -*- */
var CombSubType;
(function (CombSubType) {
    CombSubType[CombSubType["COMBHORIZONTAL"] = 0] = "COMBHORIZONTAL";
    CombSubType[CombSubType["COMBVERTICAL"] = 1] = "COMBVERTICAL";
})(CombSubType || (CombSubType = {}));
class CombTransition extends Transition2d {
    constructor(transitionParameters) {
        super(transitionParameters);
        this.direction = 0;
    }
    initProgramTemplateParams() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType == TransitionSubType.COMBVERTICAL) {
            this.direction = CombSubType.COMBVERTICAL;
        }
        else {
            this.direction = CombSubType.COMBHORIZONTAL;
        }
    }
    // jscpd:ignore-start
    getFragmentShader() {
        const isVertical = this.direction == CombSubType.COMBVERTICAL;
        // prettier-ignore
        return `#version 300 es
                precision mediump float;

                uniform sampler2D leavingSlideTexture;
                uniform sampler2D enteringSlideTexture;
                uniform float time;

                in vec2 v_texCoord;
                out vec4 outColor;

                void main() {
                    const float numTeeth = 20.0;

                    float progress = smoothstep(0.0, 1.0, time);

                    float coord = ${isVertical ? 'v_texCoord.x' : 'v_texCoord.y'};

                    float toothIndex = floor(coord * numTeeth);

                    float moveDirection = mod(toothIndex, 2.0) == 0.0 ? 1.0 : -1.0;

                    float offset = moveDirection * (1.0 - progress);

                    float threshold = moveDirection > 0.0 ?
                        ${isVertical ? 'v_texCoord.y' : 'v_texCoord.x'} :
                        ${isVertical ? '1.0 - v_texCoord.y' : '1.0 - v_texCoord.x'};

                    if (threshold < progress) {
                       vec2 enteringCoord = ${isVertical ?
            'vec2(v_texCoord.x, fract(v_texCoord.y + offset))' :
            'vec2(fract(v_texCoord.x + offset), v_texCoord.y)'};
                       outColor = texture(enteringSlideTexture, enteringCoord);
                    } else {
                        vec2 leavingCoord = ${isVertical ?
            'vec2(v_texCoord.x, fract(v_texCoord.y + offset))' :
            'vec2(fract(v_texCoord.x + offset), v_texCoord.y)'};
                        outColor = texture(leavingSlideTexture, leavingCoord);
                    }
                }`;
    }
}
SlideShow.CombTransition = CombTransition;

// @ts-strict-ignore
/* -*- js-indent-level: 8 -*- */
class PlusTransition extends ClippingTransition {
    constructor(transitionParameters) {
        super(transitionParameters);
    }
    getMaskFunction() {
        const transitionSubType = this.transitionFilterInfo.transitionSubtype;
        if (transitionSubType === TransitionSubType.CORNERSOUT)
            return `
                  float getMaskValue(vec2 uv, float time) {
                      vec2 center = vec2(0.5, 0.5);

                      vec2 dist = abs(uv - center);

                      float innerBound = 0.25 - time / 4.0;
                      float outerBound = 0.25 + time / 4.0;

                      // dist >= innerBound && dist <= outerBound
                      float mask =
                          step(innerBound, dist.x) * step(-outerBound, -dist.x) *
                          step(innerBound, dist.y) * step(-outerBound, -dist.y);

                      return mask;
                  }
          `;
        else if (transitionSubType === TransitionSubType.CORNERSIN)
            return `
                  float getMaskValue(vec2 uv, float time) {
                      vec2 center = vec2(0.5, 0.5);

                      vec2 dist = abs(uv - center);

                      float size = 1.01 * (1.0 - time) / 2.0;

                      float mask = step(size, dist.x) * step(size, dist.y);

                      return mask;
                  }
          `;
    }
}
SlideShow.PlusTransition = PlusTransition;

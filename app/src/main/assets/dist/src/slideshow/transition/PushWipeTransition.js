/* -*- js-indent-level: 8 -*- */
function PushWipeTransition(transitionParameters) {
    const transitionSubType = transitionParameters.transitionFilterInfo.transitionSubtype;
    if (transitionSubType == TransitionSubType.COMBHORIZONTAL ||
        transitionSubType == TransitionSubType.COMBVERTICAL) {
        return new SlideShow.CombTransition(transitionParameters);
    }
    else {
        return new SlideShow.PushTransition(transitionParameters);
    }
}
SlideShow.PushWipeTransition = PushWipeTransition;

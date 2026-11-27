/* -*- js-indent-level: 8 -*- */
function EllipseWipeTransition(transitionParameters) {
    const transitionSubType = transitionParameters.transitionFilterInfo.transitionSubtype;
    if (transitionSubType != TransitionSubType.VERTICAL) {
        return new SlideShow.CircleTransition(transitionParameters);
    }
    else {
        return new SlideShow.OvalTransition(transitionParameters);
    }
}
SlideShow.EllipseWipeTransition = EllipseWipeTransition;

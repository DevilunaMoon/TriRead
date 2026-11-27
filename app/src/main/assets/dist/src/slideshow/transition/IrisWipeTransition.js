/* -*- js-indent-level: 8 -*- */
function IrisWipeTransition(transitionParameters) {
    const transitionSubType = transitionParameters.transitionFilterInfo.transitionSubtype;
    if (transitionSubType == TransitionSubType.DIAMOND) {
        return new SlideShow.DiamondTransition(transitionParameters);
    }
    else {
        return new SlideShow.BoxTransition(transitionParameters);
    }
}
SlideShow.IrisWipeTransition = IrisWipeTransition;

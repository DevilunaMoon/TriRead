/* -*- js-indent-level: 8 -*- */
function BarWipeTransition(transitionParameters) {
    const transitionSubType = transitionParameters.transitionFilterInfo.transitionSubtype;
    if (transitionSubType == TransitionSubType.FADEOVERCOLOR) {
        return new SlideShow.CutTransition(transitionParameters);
    }
    else {
        return new SlideShow.WipeTransition(transitionParameters);
    }
}
SlideShow.BarWipeTransition = BarWipeTransition;

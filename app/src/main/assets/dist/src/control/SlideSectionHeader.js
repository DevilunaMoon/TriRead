// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
/*
 * A header row for a slide section: a chevron toggle, the section name and,
 * when one is given, how many slides the section holds. The slide navigator
 * and the slide import pane both build their section headers here, so
 * sections carry the same markup, classes and controls in either panel.
 */
function buildSlideSectionHeader(name, sectionIndex, collapsed, callbacks, count, options) {
    const pick = options && options.pick ? options.pick : null;
    const header = (h("div", { class: 'slide-section-header' + (collapsed ? ' collapsed' : ''), "data-section-index": sectionIndex, draggable: "false", onClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (options && options.rowToggles)
                callbacks.onToggle();
            else
                callbacks.onSelect();
        } },
        h("button", { type: "button", class: "slide-section-toggle ui-expander-btn", "aria-expanded": collapsed ? 'false' : 'true', "aria-label": _('Toggle section %1').replace('%1', name), onClick: (e) => {
                e.stopPropagation();
                e.preventDefault();
                callbacks.onToggle();
            } }),
        h("span", { class: "slide-section-name", title: name }, name),
        count && h("span", { class: "slide-section-count" }, count),
        pick && (h("input", { type: "checkbox", class: "slide-section-pick", checked: pick.checked, "aria-label": pick.label, onClick: (e) => e.stopPropagation(), onChange: () => pick.onPick() }))));
    // indeterminate is a property and not an attribute, so it is set here
    // rather than in the markup above.
    if (pick && pick.partial) {
        const box = header.querySelector('.slide-section-pick');
        if (box)
            box.indeterminate = true;
    }
    return header;
}

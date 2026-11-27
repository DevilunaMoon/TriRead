// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * SlideLinkToolbar - the small toolbar over the slide on show when that slide,
 * or the section that holds it, is linked to another file. It says that the
 * slide is linked and offers what can be done about this one slide: take the
 * link off, and read the slide again from the file it came from. For a slide
 * of a linked section it also offers to update that section.
 *
 * The toolbar follows the slide on show and acts on that slide or its section.
 * Folded, it names the link and offers an update when the file has moved on
 * since the slide or the section was read from it. Unfolded, it offers every
 * action. Each action changes the document, so a view that cannot edit is
 * offered none.
 */
/* global app _ */
class SlideLinkToolbar {
    constructor(map) {
        // The element the toolbar is drawn in, or null when the slide on show, and
        // the section that holds it, are linked to nothing.
        this.element = null;
        // Whether every action is on show, or the link alone with an update when
        // one is due. The user's choice, kept while the document is open.
        this.expanded = false;
        this.map = map;
        map.on('docloaded', this.refresh, this);
        map.on('setpart', this.refresh, this);
        map.on('updateparts', this.refresh, this);
        app.events.on('slidelink:changed', this.refresh.bind(this));
        app.events.on('updatepermission', this.refresh.bind(this));
    }
    isExpanded() {
        return this.expanded;
    }
    setExpanded(expanded) {
        this.expanded = expanded;
        this.refresh();
    }
    // The identifier of the slide on show when that slide, or the section that
    // holds it, is linked to another file, or an empty string otherwise.
    linkedPart() {
        const links = this.map.slideLinks;
        if (!links || !this.map.isPresentationOrDrawing())
            return '';
        const part = links.currentPart();
        if (!part)
            return '';
        return links.getPageLink(part) !== null || links.currentSection()
            ? part
            : '';
    }
    // Draws the toolbar for the slide on show, or takes it away when that slide
    // is linked to nothing. The toolbar is small, so it is drawn afresh each
    // time rather than kept in step piece by piece.
    refresh() {
        // A toolbar that held the focus hands it to the one drawn in its place.
        const focused = this.element !== null && this.element.contains(document.activeElement);
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        const part = this.linkedPart();
        if (!part)
            return;
        const container = document.getElementById('document-container');
        if (!container)
            return;
        this.element = this.render(part);
        container.appendChild(this.element);
        if (focused)
            this.element.querySelector('.slide-link-toolbar-expander').focus();
    }
    render(part) {
        const links = this.map.slideLinks;
        // A slide edited here loses its own link and stays in its linked section,
        // so either link can be absent.
        const link = links.getPageLink(part);
        const section = links.currentSection();
        const sectionLink = section ? links.getSectionLink(section) : null;
        const editable = this.map.isEditMode();
        const outdated = link !== null && links.isPageOutdated(part);
        const readable = link !== null && links.isPageUpdatable(part);
        const sectionOutdated = section !== '' && links.isSectionOutdated(section);
        const sectionReadable = section !== '' && links.isSectionUpdatable(section);
        const stateLabel = this.sourceStateLabel(link !== null
            ? links.getPageSourceState(part)
            : links.getSectionSourceState(section));
        // The label describes the link the way the slide's thumbnail does.
        const sourceSlide = link ? links.getSourceSlideName(part) || link.name : '';
        const description = link
            ? sourceSlide
                ? _('Linked to {0} in {1}')
                    .replace('{0}', () => sourceSlide)
                    .replace('{1}', () => link.source)
                : _('Linked to {0}').replace('{0}', () => link.source)
            : _('In a section linked to {0}').replace('{0}', () => sectionLink.source);
        const element = (h("div", { id: "slide-link-toolbar", class: 'slide-link-toolbar' + (this.expanded ? ' expanded' : ''), role: "toolbar", "aria-label": description },
            h("span", { class: "slide-link-toolbar-badge", "aria-hidden": "true" }),
            h("span", { class: "slide-link-toolbar-title", title: description }, _('Linked')),
            stateLabel ? (h("span", { class: "slide-link-toolbar-state" }, stateLabel)) : null,
            h("button", { type: "button", class: "slide-link-toolbar-expander", "aria-expanded": this.expanded ? 'true' : 'false', "aria-label": this.expanded
                    ? _('Hide the actions for this linked slide')
                    : _('Show the actions for this linked slide'), onClick: () => this.setExpanded(!this.expanded) }),
            this.expanded && editable && link ? (h("button", { type: "button", class: "button slide-link-toolbar-action unlink", onClick: () => app.dispatcher.dispatch('unlinkslide') }, _('Unlink'))) : null,
            (this.expanded || outdated) && editable && link ? (h("button", { type: "button", class: "button slide-link-toolbar-action update", disabled: !readable, onClick: () => app.dispatcher.dispatch('updatelinkedslide') }, _('Update'))) : null,
            (this.expanded || sectionOutdated) && editable && section ? (h("button", { type: "button", class: "button slide-link-toolbar-action update-section", disabled: !sectionReadable, onClick: () => app.dispatcher.dispatch('updatelinkedsection') }, _('Update section'))) : null));
        return element;
    }
    // What the toolbar says about a source that cannot be read, next to the
    // link. Nothing for a source that can.
    sourceStateLabel(state) {
        switch (state) {
            case '':
                return _('Not available');
            case 'noaccess':
                return _('No access');
            case 'missing':
                return _('Missing');
        }
        return '';
    }
}

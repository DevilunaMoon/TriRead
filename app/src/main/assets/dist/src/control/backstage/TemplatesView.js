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
/* global _ */
/*
 * "New" view: a row of blank documents, then the templates under a search box
 * and type filter chips. Also exposes templateCard, reused by HomeView.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function templateCard(template, onClick, options = {}) {
        const cls = [
            'backstage-template-card',
            options.isBlank ? 'is-blank' : '',
            options.favorite?.isFavorite ? 'is-favorite' : '',
        ]
            .filter(Boolean)
            .join(' ');
        // a localized preview that does not exist steps on to the next one
        const fallbacks = (template.previewFallbacks || []).slice();
        const nextPreview = (ev) => {
            const next = fallbacks.shift();
            if (next)
                ev.target.src = next;
        };
        return (h("div", { class: cls, id: template.id, onClick: onClick },
            h("div", { class: "template-thumbnail" },
                h("div", { class: "template-preview-frame" },
                    h("img", { class: template.preview ? null : 'is-type-icon', alt: template.name, src: template.preview || defaultPreview(template.type), onError: nextPreview }),
                    options.favorite ? favoriteButton(options.favorite) : null)),
            h("div", { class: "template-name" }, template.name)));
    }
    BackstageTemplates.templateCard = templateCard;
    function favoriteButton(favorite) {
        const label = favorite.isFavorite
            ? _('Remove from favorites')
            : _('Add to favorites');
        return (h("button", { type: "button", class: "backstage-template-favorite", "aria-pressed": String(favorite.isFavorite), "aria-label": label, title: label, onClick: (event) => {
                // The star sits on the card, and the card opens the template.
                event.stopPropagation();
                favorite.onToggle();
            } }));
    }
    function defaultPreview(type) {
        const previews = {
            writer: 'images/x-office-document.svg',
            calc: 'images/x-office-spreadsheet.svg',
            impress: 'images/x-office-presentation.svg',
            draw: 'images/x-office-drawing.svg',
        };
        return previews[type] || 'images/x-office-document.svg';
    }
    function templateExplorer(props) {
        return (h("div", { class: "backstage-template-explorer" },
            blankTemplatesRow(props.blankTemplates, props.onTemplateClick),
            h("h3", { class: "backstage-templates-heading" }, _('Templates')),
            h("div", { class: "template-search-bar" },
                searchInput(props.searchQuery, _('Search templates'), props.onSearchInput),
                filterChips(props.filter, props.onFilterChange)),
            props.sections));
    }
    BackstageTemplates.templateExplorer = templateExplorer;
    function blankTemplatesRow(templates, onClick) {
        return (h("div", { class: "template-blank-row" }, templates.map((t) => templateCard(t, () => onClick(t), { isBlank: true }))));
    }
    function typeLabel(type) {
        const labels = {
            writer: _('Document'),
            calc: _('Spreadsheet'),
            impress: _('Presentation'),
            draw: _('Drawing'),
        };
        return labels[type];
    }
    BackstageTemplates.typeLabel = typeLabel;
    function filterChips(active, onChange) {
        const chips = [
            ['all', _('All')],
            ...['writer', 'calc', 'impress', 'draw'].map((type) => [type, typeLabel(type)]),
        ];
        const select = (event, filter) => {
            const chosen = event.currentTarget;
            chosen.parentElement
                .querySelectorAll('.template-type-button')
                .forEach((chip) => {
                chip.classList.toggle('active', chip === chosen);
                chip.setAttribute('aria-pressed', String(chip === chosen));
            });
            onChange(filter);
        };
        return (h("div", { class: "template-filter-bar", role: "group", "aria-label": _('Type') }, chips.map(([filter, label]) => (h("button", { type: "button", class: filter === active
                ? 'template-type-button active'
                : 'template-type-button', "aria-pressed": String(filter === active), onClick: (event) => select(event, filter) }, label)))));
    }
    BackstageTemplates.filterChips = filterChips;
    function templateSections(props) {
        return (h("div", { class: "backstage-template-sections" },
            props.userTemplates
                ? BackstageTemplates.myTemplatesSection({
                    templates: props.userTemplates,
                    onTemplateClick: props.onClick,
                    onAddClick: props.onAddTemplate,
                    onManageClick: props.onManageTemplates,
                    favoriteState: props.favoriteState,
                })
                : null,
            h("div", { class: "backstage-template-section-header" },
                h("h4", { class: "backstage-template-section-title" }, _('Built-in templates'))),
            templateGrid(props.builtInTemplates, props.searchQuery, props.onClick, props.favoriteState)));
    }
    BackstageTemplates.templateSections = templateSections;
    function templateGrid(templates, searchQuery, onClick, favoriteState) {
        let emptyText = null;
        if (!templates.length)
            emptyText = searchQuery.trim()
                ? _('No templates match your search.')
                : _('No templates of this type.');
        return (h("div", { class: "backstage-templates-grid" },
            emptyText ? h("div", { class: "template-grid-empty" }, emptyText) : null,
            templates.map((t) => templateCard(t, () => onClick(t), { favorite: favoriteState(t) }))));
    }
    function searchInput(query, placeholder, onInput) {
        return (h("div", { class: "template-search" },
            h("span", { class: "template-search-icon", "aria-hidden": "true" }),
            h("input", { type: "search", class: "template-search-input", placeholder: placeholder, value: query, onInput: (e) => onInput(e.target.value || '') })));
    }
    BackstageTemplates.searchInput = searchInput;
})(BackstageTemplates || (BackstageTemplates = {}));

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
/* global _ formatByteSize */
/*
 * The templates that the user added: the My templates section of the New view, the Manage
 * templates view, and the dialogs that add, rename and remove a template.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function templateTypeLabel(type) {
        const labels = {
            writer: _('Document template'),
            calc: _('Spreadsheet template'),
            impress: _('Presentation template'),
            draw: _('Drawing template'),
        };
        return labels[type];
    }
    function typeIcon(type) {
        return (h("span", { class: `backstage-recent-document-icon backstage-doc-icon-${type}`, "aria-hidden": "true" }));
    }
    function fileNameWithoutExtension(fileName) {
        const dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }
    function myTemplatesSection(props) {
        return (h(Fragment, null,
            h("div", { class: "backstage-template-section-header" },
                h("h4", { class: "backstage-template-section-title" }, _('My templates')),
                h("button", { type: "button", class: "button backstage-manage-templates-button", onClick: props.onManageClick }, _('Manage'))),
            h("div", { class: "backstage-templates-grid backstage-my-templates-grid" },
                addTemplateCard(props.onAddClick),
                props.templates.map((template) => BackstageTemplates.templateCard(template, () => props.onTemplateClick(template), {
                    favorite: props.favoriteState(template),
                })))));
    }
    BackstageTemplates.myTemplatesSection = myTemplatesSection;
    function addTemplateCard(onClick) {
        return (h("div", { class: "backstage-template-card backstage-add-template-card", role: "button", tabindex: "0", onClick: onClick, onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            } },
            h("div", { class: "template-thumbnail", "aria-hidden": "true" },
                h("span", { class: "backstage-add-template-plus" })),
            h("div", { class: "template-name" }, _('Add template'))));
    }
    function manageTemplatesView(props) {
        return (h("div", { class: "backstage-manage-templates" },
            h("div", { class: "backstage-manage-templates-title" },
                h("button", { type: "button", class: "backstage-manage-templates-back", "aria-label": _('Back'), title: _('Back'), onClick: props.onBack },
                    h("span", { class: "backstage-sidebar-back-icon", "aria-hidden": "true" })),
                h("h2", { class: "backstage-content-title" }, _('Manage templates')),
                h("button", { type: "button", class: "button backstage-manage-add-template-button", onClick: props.onAdd },
                    h("span", { class: "backstage-add-template-plus", "aria-hidden": "true" }),
                    h("span", null, _('Add template')))),
            h("p", { class: "backstage-content-description" }, props.hasTemplates
                ? _("Rename or remove the templates you added. Built-in templates can't be changed.")
                : _('Templates you add will appear here and in New.')),
            props.hasTemplates ? (h(Fragment, null,
                h("div", { class: "template-search-bar" },
                    BackstageTemplates.searchInput(props.searchQuery, _('Search my templates'), props.onSearchInput),
                    BackstageTemplates.filterChips(props.filter, props.onFilterChange)),
                props.list)) : (h("div", { class: "backstage-manage-templates-empty" },
                h("h3", { class: "backstage-manage-templates-empty-title" }, _('No templates yet')),
                h("p", { class: "backstage-content-description" }, _('Add a template to start new documents from your own layout.'))))));
    }
    BackstageTemplates.manageTemplatesView = manageTemplatesView;
    // The table of the templates that match the search and the filter.
    function manageTemplatesList(props) {
        if (!props.templates.length)
            return (h("p", { class: "template-grid-empty" }, props.searchQuery.trim()
                ? _('No templates match your search.')
                : _('No templates of this type.')));
        return (h("table", { class: "backstage-manage-templates-table" },
            h("thead", { class: "backstage-recent-documents-header" },
                h("tr", { class: "backstage-recent-documents-header-row" },
                    h("th", { class: "backstage-recent-documents-header-cell" }, _('Name')),
                    h("th", { class: "backstage-recent-documents-header-cell" }, _('Type')),
                    h("th", { class: "backstage-recent-documents-header-cell", "aria-label": _('Actions') }))),
            h("tbody", null, props.templates.map((template) => (h("tr", { class: "backstage-manage-templates-row", id: `backstage-user-template-${template.id}` },
                h("td", { class: "backstage-manage-templates-name" },
                    h("div", { class: "backstage-manage-templates-name-wrapper" },
                        typeIcon(template.type),
                        h("span", { class: "backstage-recent-document-name-text" }, template.name))),
                h("td", null,
                    h("span", { class: "backstage-template-type-tag" }, BackstageTemplates.typeLabel(template.type))),
                h("td", { class: "backstage-manage-templates-row-actions" },
                    h("button", { type: "button", class: "button backstage-rename-template-button", onClick: () => props.onRename(template) },
                        h("span", { class: "backstage-template-action-icon", "aria-hidden": "true" }),
                        h("span", null, _('Rename'))),
                    h("button", { type: "button", class: "button backstage-remove-template-button", onClick: () => props.onRemove(template) },
                        h("span", { class: "backstage-template-action-icon", "aria-hidden": "true" }),
                        h("span", null, _('Remove'))))))))));
    }
    BackstageTemplates.manageTemplatesList = manageTemplatesList;
    function addTemplateDialog(props) {
        let file = null;
        let fileArea;
        let errorText;
        let nameInput;
        let addButton;
        const updateAddButton = () => {
            addButton.disabled = !file || !nameInput.value.trim();
        };
        const showError = (text) => {
            errorText.textContent = text;
        };
        const browse = async () => {
            const picked = await props.onBrowse();
            if (picked)
                setFile(picked);
        };
        const setFile = (picked) => {
            if (!picked.type) {
                showError(_('This type of file cannot be added as a template.'));
                return;
            }
            // The name follows the file until the user types a name of their own.
            if (!nameInput.value.trim() || nameInput.value === autoName(file))
                nameInput.value = fileNameWithoutExtension(picked.fileName);
            file = picked;
            showError('');
            fileArea.replaceChildren(fileRow(picked, browse));
            updateAddButton();
        };
        const autoName = (current) => current ? fileNameWithoutExtension(current.fileName) : '';
        const submit = async (event) => {
            event.preventDefault();
            const name = nameInput.value.trim();
            if (!file || !name)
                return;
            addButton.disabled = true;
            if (!(await props.onAdd(file, name))) {
                showError(_('The template could not be added.'));
                updateAddButton();
            }
        };
        const element = BackstageTemplates.modalShell({
            titleId: 'backstage-add-template-title',
            title: _('Add template'),
            onDismiss: props.onCancel,
            children: (h("form", { class: "backstage-modal-form", novalidate: true, onSubmit: submit },
                h("div", { class: "backstage-template-file-area", ref: (element) => {
                        fileArea = element;
                    } },
                    h("div", { class: "backstage-template-drop-zone" },
                        h("span", null, _('Drop a file here, or')),
                        h("button", { type: "button", class: "button", onClick: browse }, _('Browse')))),
                h("p", { class: "backstage-modal-error", role: "alert", ref: (element) => {
                        errorText = element;
                    } }),
                h("label", { class: "backstage-modal-field" },
                    h("span", { class: "backstage-modal-field-label" }, _('Name')),
                    h("input", { class: "backstage-modal-input ui-edit", type: "text", placeholder: _('Template name'), onInput: updateAddButton, ref: (element) => {
                            nameInput = element;
                        } })),
                h("div", { class: "backstage-modal-actions" },
                    h("button", { type: "button", class: "button", onClick: props.onCancel }, _('Cancel')),
                    h("button", { type: "submit", class: "button button-primary", disabled: true, ref: (element) => {
                            addButton = element;
                        } }, _('Add'))))),
        });
        return { element, setFile };
    }
    BackstageTemplates.addTemplateDialog = addTemplateDialog;
    function fileRow(file, onReplace) {
        return (h("div", { class: "backstage-template-file" },
            h("div", { class: "backstage-template-file-page", "aria-hidden": "true" }, typeIcon(file.type)),
            h("div", { class: "backstage-template-file-info" },
                h("div", { class: "backstage-template-file-name" }, file.fileName),
                h("div", { class: "backstage-template-file-details" }, templateTypeLabel(file.type) +
                    ', ' +
                    formatByteSize(file.size))),
            h("button", { type: "button", class: "button", onClick: onReplace }, _('Replace'))));
    }
    function renameTemplateDialog(props) {
        let nameInput;
        let errorText;
        const submit = async (event) => {
            event.preventDefault();
            const name = nameInput.value.trim();
            if (!name)
                nameInput.focus();
            else if (!(await props.onRename(name)))
                errorText.textContent = _('The template could not be renamed.');
        };
        const overlay = BackstageTemplates.modalShell({
            titleId: 'backstage-rename-template-title',
            title: _('Rename template'),
            onDismiss: props.onCancel,
            children: (h("form", { class: "backstage-modal-form", novalidate: true, onSubmit: submit },
                h("p", { class: "backstage-modal-error", role: "alert", ref: (element) => {
                        errorText = element;
                    } }),
                h("label", { class: "backstage-modal-field" },
                    h("span", { class: "backstage-modal-field-label" }, _('Name')),
                    h("input", { class: "backstage-modal-input ui-edit", type: "text", value: props.name, ref: (element) => {
                            nameInput = element;
                        } })),
                h("div", { class: "backstage-modal-actions" },
                    h("button", { type: "button", class: "button", onClick: props.onCancel }, _('Cancel')),
                    h("button", { type: "submit", class: "button button-primary" }, _('Rename'))))),
        });
        app.timerRegistry.setTimeout('backstagerenameselect', () => nameInput?.select(), 0);
        return overlay;
    }
    BackstageTemplates.renameTemplateDialog = renameTemplateDialog;
    function removeTemplateDialog(props) {
        const overlay = BackstageTemplates.modalShell({
            titleId: 'backstage-remove-template-title',
            title: _('Remove this template?'),
            onDismiss: props.onCancel,
            children: (h(Fragment, null,
                h("p", { class: "backstage-modal-subtitle" }, _('"%1" will be removed from My templates.').replace('%1', props.name)),
                BackstageTemplates.removeActions({
                    onCancel: props.onCancel,
                    onConfirm: props.onConfirm,
                }))),
        });
        return overlay;
    }
    BackstageTemplates.removeTemplateDialog = removeTemplateDialog;
})(BackstageTemplates || (BackstageTemplates = {}));

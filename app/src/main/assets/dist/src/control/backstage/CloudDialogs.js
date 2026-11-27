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
 * Modal dialogs for the cloud-provider flow: add/edit, the post-add
 * success dialog, and the remove confirmation. Each function returns the
 * overlay element; the caller appends it and calls .remove() to dismiss.
 * Also exports the custom kind dropdown widget.
 */
var BackstageTemplates;
(function (BackstageTemplates) {
    function modalShell(props) {
        return (h("div", { class: "backstage-modal-overlay", ref: (el) => {
                if (el)
                    el.onDismiss = props.onDismiss;
            }, onClick: (e) => {
                if (e.target === e.currentTarget)
                    props.onDismiss();
            } },
            h("div", { class: "backstage-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": props.titleId },
                h("h2", { class: "backstage-modal-title", id: props.titleId }, props.title),
                props.children)));
    }
    BackstageTemplates.modalShell = modalShell;
    function removeActions(props) {
        let cancelButton;
        setTimeout(() => cancelButton?.focus(), 0);
        return (h("div", { class: "backstage-modal-actions" },
            h("button", { type: "button", class: "button backstage-modal-cancel", onClick: props.onCancel, ref: (element) => {
                    cancelButton = element;
                } }, _('Cancel')),
            h("button", { type: "button", class: "button button-danger", onClick: props.onConfirm }, _('Remove'))));
    }
    BackstageTemplates.removeActions = removeActions;
    function addCloudDialog(props) {
        let domainInput;
        let nameInput;
        const dropdown = kindDropdown(props.initialKind, 'backstage-add-cloud-type-label');
        const submit = (e) => {
            e.preventDefault();
            const domain = domainInput.value.trim();
            const name = nameInput.value.trim();
            if (!domain) {
                domainInput.focus();
                return;
            }
            if (!name) {
                nameInput.focus();
                return;
            }
            props.onSubmit(dropdown.getValue(), name, domain);
        };
        const overlay = modalShell({
            titleId: 'backstage-add-cloud-title',
            title: props.isEdit ? _('Edit account') : _('Add new account'),
            onDismiss: props.onCancel,
            children: (h("form", { class: "backstage-modal-form", novalidate: true, onSubmit: submit },
                h("div", { class: "backstage-modal-field" },
                    h("span", { class: "backstage-modal-field-label", id: "backstage-add-cloud-type-label" }, _('Type')),
                    dropdown.element),
                h("label", { class: "backstage-modal-field" },
                    h("span", { class: "backstage-modal-field-label" }, _('Server URL')),
                    h("input", { class: "backstage-modal-input ui-edit", type: "text", required: true, placeholder: _('Enter server URL'), value: props.initialDomain, ref: (el) => {
                            domainInput = el;
                        } })),
                h("label", { class: "backstage-modal-field" },
                    h("span", { class: "backstage-modal-field-label" }, _('Display name')),
                    h("input", { class: "backstage-modal-input ui-edit", type: "text", required: true, maxlength: "40", placeholder: _('Enter display name'), value: props.initialName, ref: (el) => {
                            nameInput = el;
                        } }),
                    h("span", { class: "backstage-modal-field-hint" }, _('Name displayed in your cloud list (max. 40 characters).'))),
                props.isEdit && props.onDelete
                    ? dangerSection(props.onDelete)
                    : null,
                h("div", { class: "backstage-modal-actions" },
                    h("button", { type: "button", class: "button backstage-modal-cancel", onClick: props.onCancel }, _('Cancel')),
                    h("button", { type: "submit", class: "button button-primary" }, props.isEdit ? _('Save changes') : _('Add Account'))))),
        });
        setTimeout(() => domainInput?.focus(), 0);
        return overlay;
    }
    BackstageTemplates.addCloudDialog = addCloudDialog;
    function providerPreviewRow(props) {
        return (h("div", { class: "backstage-modal-provider-row", "aria-hidden": "true" },
            h("span", { class: 'backstage-modal-provider-row-icon ' +
                    BackstageCloudKinds.iconClasses(props.kind) }),
            h("div", { class: "backstage-modal-provider-row-text" },
                h("span", { class: "backstage-modal-provider-row-type" }, props.typeName),
                h("span", { class: "backstage-modal-provider-row-name" }, props.userName))));
    }
    function dangerSection(onDelete) {
        return (h("div", { class: "backstage-modal-danger-section" },
            h("div", { class: "backstage-modal-danger-text" },
                h("h3", { class: "backstage-modal-danger-heading" }, _('Remove account')),
                h("span", { class: "backstage-modal-danger-subtitle" }, _('Disconnects this cloud'))),
            h("button", { type: "button", class: "button button-danger-outline", onClick: onDelete }, _('Delete'))));
    }
    function cloudAddedDialog(props) {
        let openBtn;
        const overlay = modalShell({
            titleId: 'backstage-cloud-added-title',
            title: _('New account successfully added'),
            onDismiss: props.onClose,
            children: (h(Fragment, null,
                h("p", { class: "backstage-modal-subtitle" }, _('You can now access your files from this cloud.')),
                h("div", { class: "backstage-modal-preview" }, BackstageTemplates.openTile({
                    label: props.typeName,
                    iconClass: BackstageCloudKinds.iconClasses(props.kind),
                    subtitle: props.userName,
                    extraClass: 'is-cloud-provider is-preview',
                    inert: true,
                })),
                h("div", { class: "backstage-modal-actions" },
                    h("button", { type: "button", class: "button backstage-modal-cancel", onClick: props.onClose }, _('Close')),
                    h("button", { type: "button", class: "button button-primary", onClick: props.onOpen, ref: (el) => {
                            openBtn = el;
                        } }, _('Open Files'))))),
        });
        setTimeout(() => openBtn?.focus(), 0);
        return overlay;
    }
    BackstageTemplates.cloudAddedDialog = cloudAddedDialog;
    function removeConfirmDialog(props) {
        const overlay = modalShell({
            titleId: 'backstage-remove-confirm-title',
            title: _('Remove this account?'),
            onDismiss: props.onCancel,
            children: (h(Fragment, null,
                h("p", { class: "backstage-modal-subtitle" }, _("You'll be disconnected from this cloud account.")),
                providerPreviewRow({
                    typeName: props.typeName,
                    kind: props.kind,
                    userName: props.userName,
                }),
                removeActions({
                    onCancel: props.onCancel,
                    onConfirm: props.onConfirm,
                }))),
        });
        return overlay;
    }
    BackstageTemplates.removeConfirmDialog = removeConfirmDialog;
    // ---- Custom kind dropdown widget ----
    //
    // Returns the element plus a getValue() reader. State (selected value,
    // open/closed, click-outside listener) is encapsulated in this closure.
    function kindDropdown(initialValue, labelledBy) {
        const kinds = BackstageCloudKinds.list();
        // An account stored while another branding was in place names a service that is no
        // longer on offer. It reads as Other everywhere else, so editing it starts there too,
        // and saving keeps the type the user was shown.
        let currentValue = BackstageCloudKinds.offeredKind(initialValue);
        let isOpen = false;
        let wrapperEl;
        let toggleEl;
        let toggleLabelEl;
        let toggleIconEl;
        const optionEls = [];
        const updateToggle = () => {
            toggleLabelEl.textContent = BackstageCloudKinds.label(currentValue);
            toggleIconEl.className =
                'backstage-modal-dropdown-icon ' +
                    BackstageCloudKinds.iconClasses(currentValue);
        };
        const onDocMouseDown = (e) => {
            if (isOpen && !wrapperEl.contains(e.target))
                close();
        };
        const open = () => {
            if (isOpen)
                return;
            isOpen = true;
            wrapperEl.classList.add('is-open');
            toggleEl.setAttribute('aria-expanded', 'true');
            document.addEventListener('mousedown', onDocMouseDown, true);
            const selected = optionEls.find((el) => el.getAttribute('data-value') === currentValue);
            selected?.focus();
        };
        const close = () => {
            if (!isOpen)
                return;
            isOpen = false;
            wrapperEl.classList.remove('is-open');
            toggleEl.setAttribute('aria-expanded', 'false');
            document.removeEventListener('mousedown', onDocMouseDown, true);
        };
        const select = (k) => {
            currentValue = k;
            updateToggle();
            optionEls.forEach((el) => el.setAttribute('aria-selected', String(el.getAttribute('data-value') === currentValue)));
            close();
            toggleEl.focus();
        };
        const element = (h("div", { class: "backstage-modal-dropdown", ref: (el) => {
                wrapperEl = el;
            }, onKeydown: (e) => {
                if (e.key === 'Escape' && isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    close();
                    toggleEl.focus();
                }
            } },
            h("button", { type: "button", class: "backstage-modal-dropdown-toggle", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-labelledby": labelledBy, ref: (el) => {
                    toggleEl = el;
                }, onClick: () => (isOpen ? close() : open()) },
                h("span", { class: "backstage-modal-dropdown-icon", "aria-hidden": "true", ref: (el) => {
                        toggleIconEl = el;
                    } }),
                h("span", { class: "backstage-modal-dropdown-label", ref: (el) => {
                        toggleLabelEl = el;
                    } }),
                h("span", { class: "backstage-modal-dropdown-arrow", "aria-hidden": "true" }, "\u25BE")),
            h("ul", { class: "backstage-modal-dropdown-list", role: "listbox" }, kinds.map((k) => (h("li", { class: "backstage-modal-dropdown-option", role: "option", "data-value": k.kind, tabindex: "0", "aria-selected": String(k.kind === currentValue), ref: (el) => optionEls.push(el), onClick: () => select(k.kind), onKeydown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select(k.kind);
                    }
                } },
                h("span", { class: 'backstage-modal-dropdown-icon ' +
                        BackstageCloudKinds.iconClasses(k.kind), "aria-hidden": "true" }),
                h("span", null, k.label)))))));
        updateToggle();
        return {
            element,
            getValue: () => currentValue,
        };
    }
    BackstageTemplates.kindDropdown = kindDropdown;
})(BackstageTemplates || (BackstageTemplates = {}));

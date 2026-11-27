// @ts-strict-ignore -*- Mode: JavaScript; js-indent-level: 8; fill-column: 100 -*-
const VERTICAL_TABS_THRESHOLD = 4;
// A tabpage child is the content of one tab. The vertical flag asks us to
// treat every child as tab content even when it is not a tabpage. This is
// unrelated to the rail layout below: it comes from a dialog built with a
// vertical-tabs notebook, and only changes which children count as content.
function isTabContent(child, data) {
    return child.type === 'tabpage' || !!data.vertical;
}
function getTabPages(data) {
    const pages = [];
    const children = data.children;
    for (let i = 0; children && i < children.length; i++) {
        if (isTabContent(children[i], data))
            pages.push(children[i]);
    }
    return pages;
}
JSDialog.tabControl = function (parentContainer, data, builder, tabTooltip) {
    if (tabTooltip === undefined)
        tabTooltip = '';
    if (!data.tabs)
        return false;
    const pages = getTabPages(data);
    const isMultiTabJSON = pages.length > 1;
    const useVerticalRail = !data.tabControlDepth && data.tabs.length > VERTICAL_TABS_THRESHOLD;
    const tabs = [];
    const tabIds = [];
    const contentDivs = [];
    let selectedTabIdx = null;
    const cssClass = builder.options.cssClass;
    const depth = builder._currentDepth;
    const tabsContainer = (h("div", { class: 'ui-tabs ' +
            cssClass +
            ' ui-widget' +
            (useVerticalRail ? ' vertical' : ''), role: "tablist", "aria-orientation": useVerticalRail ? 'vertical' : 'horizontal' }));
    // The hidden tabs still name their pages for assistive technology.
    if (data.showTabs === false)
        tabsContainer.classList.add('hidden');
    const contentsContainer = (h("div", { class: 'ui-tabs-content ' + cssClass }));
    const rootContainer = (h("div", { class: 'ui-tabs-root ' + cssClass + (useVerticalRail ? ' vertical' : ''), id: data.id },
        builder.options.useSetTabs ? false : tabsContainer,
        contentsContainer));
    for (let tabIdx = 0; tabIdx < data.tabs.length; tabIdx++) {
        const item = data.tabs[tabIdx];
        const title = builder._cleanText(item.text);
        // Core sends a plain number id, so prefix it with the control id to keep
        // it distinct from the same number used by other controls.
        const tabId = Number.isInteger(parseInt(item.id))
            ? data.id + '-' + item.id
            : item.id;
        const isSelectedTab = data.selected == item.id;
        const contentDiv = (h("div", { class: 'ui-content level-' + depth + ' ' + cssClass, id: item.name, role: "tabpanel", "aria-labelledby": tabId }));
        const tabLabel = (h("span", { class: "ui-tab-label" }, title));
        const tab = (h("button", { class: 'ui-tab ' + cssClass, id: tabId, role: "tab", "aria-controls": contentDiv.id }, tabLabel));
        JSDialog.AddAriaLabel(tab, item, builder);
        builder._setAccessKey(tab, builder._getAccessKeyFromText(item.text));
        builder._stressAccessKey(tabLabel, tab.accessKey);
        if (isSelectedTab) {
            tab.classList.add('selected');
            tab.setAttribute('aria-selected', 'true');
            tab.tabIndex = 0;
            tab.setAttribute('data-cooltip', tabTooltip);
            selectedTabIdx = tabIdx;
        }
        else {
            tab.setAttribute('aria-selected', 'false');
            tab.tabIndex = -1;
            contentDiv.classList.add('hidden');
        }
        if (item.context) {
            const hasCurrentContext = builder.map.context.context !== '' &&
                item.context.indexOf(builder.map.context.context) !== -1;
            const hasDefaultContext = item.context.indexOf('default') !== -1;
            if (!hasCurrentContext && !hasDefaultContext)
                tab.classList.add('hidden');
        }
        tabsContainer.appendChild(tab);
        contentsContainer.appendChild(contentDiv);
        tabs[tabIdx] = tab;
        tabIds[tabIdx] = item.name;
        contentDivs[tabIdx] = contentDiv;
    }
    parentContainer.appendChild(rootContainer);
    if (builder.wizard) {
        if (builder.options.useSetTabs)
            builder.wizard.setTabs(tabsContainer, builder);
        const selectTabs = tabs.map(function (tab, index) {
            return builder._createTabClick(builder, index, tabs, contentDivs, tabIds);
        });
        function openTab(index) {
            selectTabs[index]();
            if (!data.noCoreEvents)
                builder.callback('tabcontrol', 'selecttab', rootContainer, index, builder);
        }
        function getFillCheckbox(tabEl) {
            return document.getElementById(tabEl.id + '-fill-input');
        }
        tabs.forEach(function (tab, index) {
            tab.addEventListener('click', function () {
                openTab(index);
            });
            tab.addEventListener('keydown', function (e) {
                if (e.key === ' ' || e.key === 'Spacebar') {
                    const fillCheckbox = getFillCheckbox(tab);
                    if (fillCheckbox) {
                        e.preventDefault();
                        fillCheckbox.checked = !fillCheckbox.checked;
                        fillCheckbox.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
        JSDialog.KeyboardTabNavigation(tabs, contentDivs, useVerticalRail);
    }
    else {
        window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
    }
    if (isMultiTabJSON) {
        for (let i = 0; i < pages.length && i < contentDivs.length; i++) {
            builder.build(contentDivs[i], [pages[i]], false);
        }
    }
    else if (selectedTabIdx != null && pages.length) {
        builder.build(contentDivs[selectedTabIdx], [pages[0]], false);
    }
    return false;
};
